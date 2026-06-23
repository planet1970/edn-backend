import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadService } from '../common/upload/upload.service';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

@Injectable()
export class SocialMediaService implements OnModuleInit {
  private readonly logger = new Logger(SocialMediaService.name);

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  private telegramOffset = 0;
  private isPollingTelegram = false;

  async onModuleInit() {
    // Initialize telegramOffset to latest to avoid reprocessing old updates on server start
    try {
      const setting = await this.prisma.telegramSetting.findFirst();
      if (setting && setting.isActive && setting.botToken) {
        const url = `https://api.telegram.org/bot${setting.botToken}/getUpdates?limit=1&offset=-1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.result.length > 0) {
            this.telegramOffset = data.result[0].update_id + 1;
            this.logger.log(`Telegram polling initialized. Offset: ${this.telegramOffset}`);
          }
        }
      }
    } catch (err) {
      this.logger.error('Telegram offset init failed:', err);
    }
  }

  async uploadPostMedia(postId: number, file: Express.Multer.File) {
    const post = await this.prisma.socialMediaPost.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new Error('Gönderi bulunamadı.');
    }

    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      const videoUrl = await this.uploadService.handleFile(file, 'social-posts', post.videoUrl || undefined);
      // Clean up old image if there was one
      if (post.imageUrl) {
        try {
          await this.uploadService.deleteFile(post.imageUrl);
        } catch {}
      }
      return this.prisma.socialMediaPost.update({
        where: { id: postId },
        data: { videoUrl, imageUrl: null },
      });
    } else {
      const imageUrl = await this.uploadService.handleFile(file, 'social-posts', post.imageUrl || undefined);
      // Clean up old video if there was one
      if (post.videoUrl) {
        try {
          await this.uploadService.deleteFile(post.videoUrl);
        } catch {}
      }
      return this.prisma.socialMediaPost.update({
        where: { id: postId },
        data: { imageUrl, videoUrl: null },
      });
    }
  }

  private getAbsoluteUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = (process.env.BACKEND_URL || 'https://api.edirnego.com').replace(/\/$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanUrl}`;
  }  // 1. Generate post content using specified AI APIs (or simulated)
  async generatePost(
    prompt: string,
    platform: string,
    tone: string,
    textProvider?: string,
    imageProvider?: string,
    videoProvider: string = 'simulation',
    includeImage: boolean = false,
    includeVideo: boolean = false,
    postType: string = 'POST',
    textModel?: string,
    imageModel?: string,
  ) {
    const aiSettings = await this.getAiSettings();
    
    // Resolve providers and models with fallbacks to defaults
    let activeTextProvider = textProvider || aiSettings.defaultTextProvider || 'gemini';
    let activeTextModel = textModel || aiSettings.defaultTextModel || 'gemini-2.5-flash';
    let activeImageProvider = imageProvider || aiSettings.defaultImageProvider || 'huggingface';
    let activeImageModel = imageModel || aiSettings.defaultImageModel || 'flux';

    // Find custom configs if any
    let customTextConfig: any = null;
    let customImageConfig: any = null;
    if (aiSettings.customModels && Array.isArray(aiSettings.customModels)) {
      const modelsList = aiSettings.customModels as any[];
      customTextConfig = modelsList.find(
        (m: any) => String(m.id) === String(activeTextProvider) || m.name === activeTextProvider
      );
      customImageConfig = modelsList.find(
        (m: any) => String(m.id) === String(activeImageProvider) || m.name === activeImageProvider
      );
    }

    const logs: string[] = [];
    let caption = '';
    let imagePrompt = '';
    let videoPrompt = '';
    let imageUrl = '';
    let videoUrl = '';
    let textProviderUsed = customTextConfig ? customTextConfig.name : activeTextProvider;
    let imageProviderUsed = customImageConfig ? customImageConfig.name : activeImageProvider;
    let videoProviderUsed = videoProvider;

    const isStory = postType === 'STORY';

    // System instruction for Text AIs
    const systemInstruction = `Sen profesyonel bir sosyal medya içerik üreticisisin. 
Kullanıcının belirteceği konu veya prompt doğrultusunda, belirtilen platform ve ses tonuna uygun, dikkat çekici, emojilerle zenginleştirilmiş ve popüler hashtag'leri içeren bir paylaşım yazısı hazırla.

Paylaşım yazısı için kurallar:
1. ${isStory 
     ? 'Hedef paylaşım türü HİKAYE (STORY) olduğu için paylaşım metni (caption) SON DERECE KISA, ÖZ VE VURUCU OLMALIDIR. Sıradan olmayan, son derece yaratıcı, merak uyandırıcı ve estetik 1 veya 2 çarpıcı slogan/cümle (en fazla 10-15 kelime) yaz. Kesinlikle uzun paragraflar, açıklamalar yazma.'
     : 'Konu hakkında mümkün olduğunca az bilinen, şaşırtıcı, yaratıcı ve ilgi çekici detaylara yer ver. Eğer spesifik bir konu isteniyorsa, o konuyla ilgili derinlemesine ilginç, özgün ve detaylı bilgiler sun.'}
2. Paylaşımın sonuna kesinlikle "yorumlar kısmında buluşalım", "yorumlar da buluşalım", "yorumlarınızı bekliyorum" veya benzeri yorum yapma çağrıları (call-to-action) ekleme.

Görsel promptu (imagePrompt) için kurallar:
1. Görsel üretim promptunu detaylı ve İngilizce olarak yaz.
2. Görselde insan figürü/kullanımı olmamasına (insan figürlerinden kaçınmaya) özen göster.
3. Görsel tarzında sert/net çizgiler ve yapay parlaklıklar yerine; daha yumuşak, soft, atmosferik, sanatsal, rüya gibi ve estetik (soft focus, atmospheric, artistic style, gentle lighting, painterly details, avoid harsh outlines, no human figures) bir hava tarif et.

Video promptu (videoPrompt) için kurallar:
1. Video üretim promptunu detaylı ve İngilizce olarak yaz.

Çıktıyı kesinlikle geçerli bir JSON formatında ver. JSON formatı şu şekilde olmalıdır:
{
  "caption": "Sosyal medya gönderi metni...",
  "imagePrompt": "İngilizce görsel üretim promptu...",
  "videoPrompt": "İngilizce video üretim promptu..."
}`;

    // --- 1. Text Generation ---
    if (customTextConfig) {
      const customKey = customTextConfig.apiKey;
      const customUrl = customTextConfig.apiUrl.replace(/\/$/, '');
      const modelName = customTextConfig.selectedModel || activeTextModel;

      try {
        logs.push(`Özel API (${customTextConfig.name}) ile metin üretiliyor... model: ${modelName}`);
        const response = await fetch(`${customUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Özel model API hatası: ${response.statusText} - ${errText}`);
        }

        const resData = await response.json();
        const textResponse = resData.choices?.[0]?.message?.content;
        if (textResponse) {
          const parsed = JSON.parse(textResponse);
          caption = parsed.caption || '';
          imagePrompt = parsed.imagePrompt || '';
          videoPrompt = parsed.videoPrompt || '';
          logs.push(`Metin özel model (${customTextConfig.name} - ${modelName}) ile başarıyla üretildi.`);
        }
      } catch (error) {
        this.checkAiTokenError(error, `Özel Model (${customTextConfig.name})`);
        logs.push(`Özel model metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
        textProviderUsed = 'simulation';
      }
    } else if (activeTextProvider === 'openai') {
      const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
      const openAiUrl = (aiSettings.openAiUrl || 'https://api.openai.com').replace(/\/$/, '');
      if (!openAiKey) {
        logs.push('OPENAI_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(`${openAiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: activeTextModel || 'gpt-4o-mini',
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
              ],
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API hatası: ${response.statusText} - ${errText}`);
          }

          const resData = await response.json();
          const textResponse = resData.choices?.[0]?.message?.content;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            caption = parsed.caption || '';
            imagePrompt = parsed.imagePrompt || '';
            videoPrompt = parsed.videoPrompt || '';
            logs.push(`Metin OpenAI (${activeTextModel}) ile başarıyla üretildi.`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'OpenAI (Metin)');
          logs.push(`OpenAI metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          textProviderUsed = 'simulation';
        }
      }
    } else if (activeTextProvider === 'claude') {
      const claudeKey = aiSettings.claudeKey || process.env.CLAUDE_API_KEY;
      const claudeUrl = (aiSettings.claudeUrl || 'https://api.anthropic.com').replace(/\/$/, '');
      if (!claudeKey) {
        logs.push('CLAUDE_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(`${claudeUrl}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: activeTextModel || 'claude-3-5-sonnet-20241022',
              max_tokens: 1000,
              system: systemInstruction,
              messages: [
                { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
              ]
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Claude API hatası: ${response.statusText} - ${errText}`);
          }

          const resData = await response.json();
          const textResponse = resData.content?.[0]?.text;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            caption = parsed.caption || '';
            imagePrompt = parsed.imagePrompt || '';
            videoPrompt = parsed.videoPrompt || '';
            logs.push(`Metin Anthropic Claude (${activeTextModel}) ile başarıyla üretildi.`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'Anthropic Claude (Metin)');
          logs.push(`Claude metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          textProviderUsed = 'simulation';
        }
      }
    } else if (activeTextProvider === 'gemini') {
      const geminiKey = aiSettings.geminiKey || process.env.GEMINI_API_KEY;
      const geminiUrl = (aiSettings.geminiUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      if (!geminiKey) {
        logs.push('GEMINI_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(
            `${geminiUrl}/v1beta/models/${activeTextModel || 'gemini-2.5-flash'}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  { role: 'user', parts: [{ text: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }] }
                ],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
              })
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API hatası: ${response.statusText} - ${errText}`);
          }

          const resData = await response.json();
          const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            caption = parsed.caption || '';
            imagePrompt = parsed.imagePrompt || '';
            videoPrompt = parsed.videoPrompt || '';
            logs.push(`Metin Google Gemini (${activeTextModel}) ile başarıyla üretildi.`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'Google Gemini (Metin)');
          logs.push(`Gemini metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          textProviderUsed = 'simulation';
        }
      }
    }

    // Run simulation fallback
    if (textProviderUsed === 'simulation' || !caption) {
      const sim = this.getSimulatedResponse(prompt, platform, tone);
      caption = sim.caption;
      imagePrompt = sim.imagePrompt;
      videoPrompt = `A beautiful high-quality cinematic video showing historical ${prompt} in Edirne, Turkey.`;
      logs.push('Simülasyon metin ve promptları üretildi.');
    }

    // --- 2. Image Generation ---
    if (includeImage) {
      if (customImageConfig) {
        const customKey = customImageConfig.apiKey;
        const customUrl = customImageConfig.apiUrl.replace(/\/$/, '');
        const modelName = customImageConfig.selectedModel || activeImageModel;

        try {
          logs.push(`Özel API (${customImageConfig.name}) ile görsel üretiliyor... model: ${modelName}`);
          const response = await fetch(`${customUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${customKey}`
            },
            body: JSON.stringify({
              model: modelName,
              prompt: imagePrompt,
              n: 1,
              size: '1024x1024'
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Özel model görsel API hatası: ${response.statusText} - ${errText}`);
          }

          const data = await response.json();
          imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json || '';
          if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
            imageUrl = `data:image/png;base64,${imageUrl}`;
          }
          logs.push(`Görsel özel model (${customImageConfig.name} - ${modelName}) ile başarıyla üretildi.`);
        } catch (error) {
          this.checkAiTokenError(error, `Özel Görsel Modeli (${customImageConfig.name})`);
          logs.push(`Özel model görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          imageProviderUsed = 'simulation';
        }
      } else if (activeImageProvider === 'dalle') {
        const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
        const openAiUrl = (aiSettings.openAiUrl || 'https://api.openai.com').replace(/\/$/, '');
        if (!openAiKey) {
          logs.push('OPENAI_API_KEY bulunamadı. DALL-E görsel üretimi için simülasyon moduna geçiliyor.');
          imageProviderUsed = 'simulation';
        } else {
          try {
            const response = await fetch(`${openAiUrl}/v1/images/generations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
              },
              body: JSON.stringify({
                model: activeImageModel || 'dall-e-3',
                prompt: imagePrompt,
                n: 1,
                size: '1024x1024'
              })
            });

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`DALL-E hatası: ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            imageUrl = data.data?.[0]?.url || '';
            logs.push(`Görsel OpenAI DALL-E (${activeImageModel || 'dall-e-3'}) ile başarıyla üretildi.`);
          } catch (error) {
            this.checkAiTokenError(error, 'OpenAI DALL-E 3 (Görsel)');
            logs.push(`DALL-E görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
            imageProviderUsed = 'simulation';
          }
        }
      } else if (activeImageProvider === 'stability') {
        const stabilityKey = aiSettings.stabilityKey || process.env.STABILITY_API_KEY;
        if (!stabilityKey) {
          logs.push('STABILITY_API_KEY bulunamadı. Stability AI görsel üretimi için simülasyon moduna geçiliyor.');
          imageProviderUsed = 'simulation';
        } else {
          try {
            const response = await fetch(
              'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${stabilityKey}`
                },
                body: JSON.stringify({
                  text_prompts: [{ text: imagePrompt }],
                  cfg_scale: 7,
                  height: 1024,
                  width: 1024,
                  samples: 1,
                  steps: 30
                })
              }
            );

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Stability AI hatası: ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            const base64 = data.artifacts?.[0]?.base64;
            if (base64) {
              imageUrl = `data:image/png;base64,${base64}`;
              logs.push('Görsel Stability AI ile başarıyla üretildi.');
            }
          } catch (error) {
            this.checkAiTokenError(error, 'Stability AI (Görsel)');
            logs.push(`Stability AI görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
            imageProviderUsed = 'simulation';
          }
        }
      } else if (activeImageProvider === 'huggingface') {
        const hfKey = aiSettings.huggingFaceKey || process.env.HUGGINGFACE_API_KEY;
        if (!hfKey) {
          logs.push('HUGGINGFACE_API_KEY bulunamadı. Hugging Face görsel üretimi için simülasyon moduna geçiliyor.');
          imageProviderUsed = 'simulation';
        } else {
          try {
            const modelPath = activeImageModel || 'black-forest-labs/FLUX.1-schnell';
            const response = await fetch(
              `https://router.huggingface.co/hf-inference/models/${modelPath}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${hfKey}`,
                },
                body: JSON.stringify({ inputs: imagePrompt }),
              },
            );

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Hugging Face hatası: ${response.statusText} - ${errText}`);
            }

            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            imageUrl = `data:image/jpeg;base64,${base64}`;
            logs.push('Görsel Hugging Face (Stable Diffusion XL) ile başarıyla üretildi.');
          } catch (error) {
            this.checkAiTokenError(error, 'Hugging Face FLUX (Görsel)');
            logs.push(`Hugging Face görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
            imageProviderUsed = 'simulation';
          }
        }
      }

      if (imageProviderUsed === 'simulation' || !imageUrl) {
        // Return a beautiful Unsplash stock photo based on the prompt keywords
        const keywords = prompt
          .toLowerCase()
          .replace(/[^a-zA-Z0-9ığüşöç\s]/g, '')
          .split(' ')
          .filter(w => w.length > 3)
          .slice(0, 3)
          .join(',');
        const query = keywords ? encodeURIComponent(keywords) : 'edirne,turkey';
        imageUrl = `https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80`; // Turkey/Mosque
        if (query.includes('yemek') || query.includes('tava') || query.includes('ciğer')) {
          imageUrl = `https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80`; // Food
        }
        logs.push('Simüle edilmiş Unsplash görseli atandı.');
      }
    }

    // --- 3. Video Generation ---
    if (includeVideo) {
      if (videoProvider === 'runway') {
        const runwayKey = process.env.RUNWAY_API_KEY;
        if (!runwayKey) {
          logs.push('RUNWAY_API_KEY bulunamadı. Runway video üretimi için simülasyon moduna geçiliyor.');
          videoProviderUsed = 'simulation';
        } else {
          logs.push('Runway API anahtarı doğrulandı. Runway Gen-2 video üretimi simüle ediliyor.');
          videoProviderUsed = 'simulation';
        }
      } else if (videoProvider === 'sora') {
        const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
        if (!openAiKey) {
          logs.push('OPENAI_API_KEY bulunamadı. Sora video üretimi için simülasyon moduna geçiliyor.');
          videoProviderUsed = 'simulation';
        } else {
          logs.push('OpenAI API anahtarı doğrulandı. Sora video üretimi simüle ediliyor.');
          videoProviderUsed = 'simulation';
        }
      }

      if (videoProviderUsed === 'simulation' || !videoUrl) {
        // Return a beautiful free MP4 video link from Mixkit
        const keywords = prompt.toLowerCase();
        if (keywords.includes('doğa') || keywords.includes('meriç') || keywords.includes('nehir')) {
          videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-countryside-meadow-with-river-in-middle-41712-large.mp4';
        } else if (keywords.includes('tarih') || keywords.includes('cami') || keywords.includes('selimiye')) {
          videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-historical-building-under-a-clear-blue-sky-42861-large.mp4';
        } else {
          videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-harbor-city-and-sea-41617-large.mp4';
        }
        logs.push('Simüle edilmiş Mixkit videosu atandı.');
      }
    }

    const savedImageUrl = imageUrl ? this.saveBase64Media(imageUrl, 'social-image') : imageUrl;
    const savedVideoUrl = videoUrl ? this.saveBase64Media(videoUrl, 'social-video') : videoUrl;

    return {
      caption,
      imagePrompt,
      videoPrompt,
      imageUrl: savedImageUrl,
      videoUrl: savedVideoUrl,
      textProviderUsed,
      imageProviderUsed,
      videoProviderUsed,
      isSimulated: textProviderUsed === 'simulation' && imageProviderUsed === 'simulation' && videoProviderUsed === 'simulation',
      logs
    };
  }

  private saveBase64Media(dataUrl: string, prefix: string): string {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return dataUrl;
    }

    try {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return dataUrl;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      let extension = 'png';
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        extension = 'jpg';
      } else if (mimeType.includes('gif')) {
        extension = 'gif';
      } else if (mimeType.includes('mp4')) {
        extension = 'mp4';
      }

      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${prefix}-${Date.now()}.${extension}`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);

      return `/uploads/${filename}`;
    } catch (error) {
      this.logger.error('Base64 medya kaydedilirken hata:', error);
      return dataUrl;
    }
  }

  private async overlayTextOnImage(relativeImagePath: string, text: string): Promise<string | null> {
    if (!relativeImagePath) return null;
    
    try {
      let imageBuffer: Buffer;
      let outputAbsolutePath: string;
      let relativeOutputDir: string;
      let outputFilename: string;

      if (relativeImagePath.startsWith('http://') || relativeImagePath.startsWith('https://')) {
        const response = await fetch(relativeImagePath);
        if (!response.ok) {
          throw new Error(`Uzaktaki görsel indirilemedi: ${response.statusText}`);
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());

        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        outputFilename = `story-overlay-${Date.now()}.png`;
        outputAbsolutePath = path.join(uploadDir, outputFilename);
        relativeOutputDir = 'uploads';
      } else {
        const cleanPath = relativeImagePath.startsWith('/') ? relativeImagePath.substring(1) : relativeImagePath;
        const absolutePath = path.join(process.cwd(), cleanPath);
        
        if (!fs.existsSync(absolutePath)) {
          this.logger.warn(`Görsel bulunamadı: ${absolutePath}`);
          return null;
        }
        
        imageBuffer = fs.readFileSync(absolutePath);
        const ext = path.extname(absolutePath) || '.png';
        const base = path.basename(absolutePath, ext);
        outputFilename = `${base}-story${ext}`;
        const outputDir = path.dirname(absolutePath);
        outputAbsolutePath = path.join(outputDir, outputFilename);
        relativeOutputDir = path.dirname(cleanPath);
      }
      
      // Target resolution for Instagram Stories: 1080x1920 (9:16 aspect ratio)
      const targetWidth = 1080;
      const targetHeight = 1920;
      
      // 1. Resize original image with smart aspect-ratio check
      const metadata = await sharp(imageBuffer).metadata();
      const originalWidth = metadata.width || 1080;
      const originalHeight = metadata.height || 1920;
      const resizedHeight = Math.round(originalHeight * (targetWidth / originalWidth));

      let resizedBuffer: Buffer;
      if (resizedHeight > targetHeight) {
        resizedBuffer = await sharp(imageBuffer)
          .resize({
            width: targetWidth,
            height: targetHeight,
            fit: 'cover',
            position: 'top'
          })
          .toBuffer();
      } else {
        resizedBuffer = await sharp(imageBuffer)
          .resize({ width: targetWidth })
          .toBuffer();
      }

      // 2. Create a white 1080x1920 canvas and overlay the resized image at the top (overflow gets cropped at 1920)
      const processedBuffer = await sharp({
        create: {
          width: targetWidth,
          height: targetHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .composite([{ input: resizedBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();
      
      // Split text into lines (max 28 characters per line, preserving explicit newlines)
      const rawLines = text.split(/\r?\n/);
      const lines: string[] = [];
      for (const rawLine of rawLines) {
        const words = rawLine.trim().split(/\s+/);
        let currentLine = '';
        for (const word of words) {
          if (!word) continue;
          if ((currentLine + ' ' + word).length > 28) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          }
        }
        if (currentLine) {
          lines.push(currentLine.trim());
        }
      }
      
      const fontSize = 42;
      const lineHeight = fontSize * 1.45;
      const padding = fontSize * 1.2;
      const boxHeight = lines.length * lineHeight + padding * 2;
      const boxWidth = targetWidth * 0.72; // 72% width (778px) to leave 14% safe margins on sides
      const boxX = (targetWidth - boxWidth) / 2; // 151px margin on left and right
      const boxY = targetHeight - boxHeight - (targetHeight * 0.16); // 16% margin from bottom to stay clear of bottom UI
      
      let textElements = '';
      lines.forEach((line, index) => {
        const yPos = boxY + padding + (index * lineHeight) + fontSize;
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        textElements += `<text x="${targetWidth / 2}" y="${yPos}" fill="white" font-family="sans-serif" font-size="${fontSize}px" font-weight="bold" text-anchor="middle">${escapedLine}</text>`;
      });
      
      const svgOverlay = `
        <svg width="${targetWidth}" height="${targetHeight}">
          <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${fontSize * 0.5}" ry="${fontSize * 0.5}" fill="black" fill-opacity="0.65" />
          ${textElements}
        </svg>
      `;
      
      await sharp(processedBuffer)
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .toFile(outputAbsolutePath);
        
      return `/${relativeOutputDir}/${outputFilename}`.replace(/\\/g, '/');
    } catch (error) {
      this.logger.error('Story görseline metin ekleme hatası:', error);
      return null;
    }
  }

  async regenerateImage(
    imagePrompt: string,
    feedback?: string,
    imageProvider: string = 'huggingface',
    imageModel?: string,
  ) {
    const aiSettings = await this.getAiSettings();
    let activeImageProvider = imageProvider;
    let activeImageModel = imageModel || aiSettings.defaultImageModel || 'flux';

    // Find custom configs if any
    let customImageConfig: any = null;
    if (aiSettings.customModels && Array.isArray(aiSettings.customModels)) {
      customImageConfig = (aiSettings.customModels as any[]).find(
        (m: any) => String(m.id) === String(activeImageProvider) || m.name === activeImageProvider
      );
    }

    const logs: string[] = [];
    let finalPrompt = imagePrompt;
    let imageProviderUsed = customImageConfig ? customImageConfig.name : activeImageProvider;
    let imageUrl = '';

    if (feedback && feedback.trim()) {
      const geminiKey = aiSettings.geminiKey || process.env.GEMINI_API_KEY;
      const geminiUrl = (aiSettings.geminiUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      if (geminiKey) {
        try {
          logs.push(`Görsel promptu kullanıcının geribildirimiyle ("${feedback}") güncelleniyor...`);
          const systemInstruction = `You are an expert AI prompt engineer. Refine the given English image generation prompt incorporating the user's Turkish feedback/correction. 
The updated prompt must follow these strict rules:
1. Avoid human figures/presence.
2. Use a soft, atmospheric, artistic, or painterly style. Avoid harsh/sharp outlines.
3. Keep the prompt in English.
Output ONLY the final updated English prompt. Do not write any introduction, code blocks, or explanation.`;

          const response = await fetch(
            `${geminiUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  { role: 'user', parts: [{ text: `Original Prompt: "${imagePrompt}"\nUser Feedback: "${feedback}"\n\nGenerate the refined English prompt:` }] }
                ],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.7 }
              })
            }
          );

          if (response.ok) {
            const resData = await response.json();
            const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse && textResponse.trim()) {
              finalPrompt = textResponse.trim().replace(/^["']|["']$/g, '');
              logs.push(`Yeni görsel promptu: "${finalPrompt}"`);
            }
          } else {
            logs.push('Gemini ile prompt güncelleme başarısız oldu, orijinal prompt kullanılacak.');
          }
        } catch (error) {
          logs.push(`Prompt güncelleme sırasında hata: ${error.message}`);
        }
      } else {
        logs.push('GEMINI_API_KEY bulunamadı, feedback uygulanamadı.');
      }
    }

    if (customImageConfig) {
      const customKey = customImageConfig.apiKey;
      const customUrl = customImageConfig.apiUrl.replace(/\/$/, '');
      const modelName = customImageConfig.selectedModel || activeImageModel;

      try {
        logs.push(`Özel API (${customImageConfig.name}) ile görsel yeniden üretiliyor... model: ${modelName}`);
        const response = await fetch(`${customUrl}/v1/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customKey}`
          },
          body: JSON.stringify({
            model: modelName,
            prompt: finalPrompt,
            n: 1,
            size: '1024x1024'
          })
        });

        if (response.ok) {
          const data = await response.json();
          imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json || '';
          if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
            imageUrl = `data:image/png;base64,${imageUrl}`;
          }
          logs.push(`Görsel özel model (${customImageConfig.name} - ${modelName}) ile başarıyla yeniden üretildi.`);
        } else {
          const errText = await response.text();
          throw new Error(`Özel model API hatası: ${response.statusText} - ${errText}`);
        }
      } catch (error) {
        this.checkAiTokenError(error, `Özel Görsel Modeli (${customImageConfig.name})`);
        logs.push(`Özel model görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
        imageProviderUsed = 'simulation';
      }
    } else if (activeImageProvider === 'dalle') {
      const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
      const openAiUrl = (aiSettings.openAiUrl || 'https://api.openai.com').replace(/\/$/, '');
      if (!openAiKey) {
        logs.push('OPENAI_API_KEY bulunamadı. DALL-E görsel üretimi için simülasyon moduna geçiliyor.');
        imageProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(`${openAiUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
              model: activeImageModel || 'dall-e-3',
              prompt: finalPrompt,
              n: 1,
              size: '1024x1024'
            })
          });

          if (response.ok) {
            const data = await response.json();
            imageUrl = data.data?.[0]?.url || '';
            logs.push(`Görsel OpenAI DALL-E (${activeImageModel || 'dall-e-3'}) ile başarıyla yeniden üretildi.`);
          } else {
            const errText = await response.text();
            throw new Error(`DALL-E hatası: ${response.statusText} - ${errText}`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'OpenAI DALL-E 3 (Yeniden Görsel)');
          logs.push(`DALL-E görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          imageProviderUsed = 'simulation';
        }
      }
    } else if (activeImageProvider === 'stability') {
      const stabilityKey = aiSettings.stabilityKey || process.env.STABILITY_API_KEY;
      if (!stabilityKey) {
        logs.push('STABILITY_API_KEY bulunamadı. Stability AI görsel üretimi için simülasyon moduna geçiliyor.');
        imageProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(
            'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${stabilityKey}`
              },
              body: JSON.stringify({
                text_prompts: [{ text: finalPrompt }],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                samples: 1,
                steps: 30
              })
            }
          );

          if (response.ok) {
            const data = await response.json();
            const base64 = data.artifacts?.[0]?.base64;
            if (base64) {
              imageUrl = `data:image/png;base64,${base64}`;
              logs.push('Görsel Stability AI ile başarıyla yeniden üretildi.');
            }
          } else {
            const errText = await response.text();
            throw new Error(`Stability AI hatası: ${response.statusText} - ${errText}`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'Stability AI (Yeniden Görsel)');
          logs.push(`Stability AI görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          imageProviderUsed = 'simulation';
        }
      }
    } else if (activeImageProvider === 'huggingface') {
      const hfKey = aiSettings.huggingFaceKey || process.env.HUGGINGFACE_API_KEY;
      if (!hfKey) {
        logs.push('HUGGINGFACE_API_KEY bulunamadı. Hugging Face görsel üretimi için simülasyon moduna geçiliyor.');
        imageProviderUsed = 'simulation';
      } else {
        try {
          const modelPath = activeImageModel || 'black-forest-labs/FLUX.1-schnell';
          const response = await fetch(
            `https://router.huggingface.co/hf-inference/models/${modelPath}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${hfKey}`,
              },
              body: JSON.stringify({ inputs: finalPrompt }),
            },
          );

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            imageUrl = `data:image/jpeg;base64,${base64}`;
            logs.push(`Görsel Hugging Face (${modelPath}) ile başarıyla yeniden üretildi.`);
          } else {
            const errText = await response.text();
            throw new Error(`Hugging Face hatası: ${response.statusText} - ${errText}`);
          }
        } catch (error) {
          this.checkAiTokenError(error, 'Hugging Face FLUX (Yeniden Görsel)');
          logs.push(`Hugging Face görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          imageProviderUsed = 'simulation';
        }
      }
    }

    if (imageProviderUsed === 'simulation' || !imageUrl) {
      const ts = Date.now();
      imageUrl = `https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80&sig=${ts}`;
      logs.push('Simüle edilmiş Unsplash görseli atandı.');
    }

    const savedImageUrl = imageUrl ? this.saveBase64Media(imageUrl, 'social-image') : imageUrl;

    return {
      imageUrl: savedImageUrl,
      imagePrompt: finalPrompt,
      imageProviderUsed,
      logs,
    };
  }

  private getSimulatedResponse(prompt: string, platform: string, tone: string) {
    const formattedPrompt = prompt ? `"${prompt}"` : 'Edirne turizmi';
    return {
      caption: `🌟 [Simülasyon Modu] ${formattedPrompt} hakkında harika bir ${platform} paylaşımı! (${tone} tonunda)\n\nEdirne'nin zengin tarihi ve eşsiz kültürel mirasları her köşede sizi bekliyor. Selimiye Camii'nden Meriç Köprüsü'ne kadar uzanan bu eşsiz serüveni keşfetmeye hazır mısınız? 🕌🌉✨\n\n#EdirneGezisi #TarihiŞehirEdirne #EdirneKültürü #Gezginler #SeyahatNotları #Simülasyon`,
      imagePrompt: `A beautiful soft-focus, atmospheric, artistic shot of historical ${prompt} in Edirne, Turkey, warm lighting, dreamlike quality, no people, painterly details.`,
      isSimulated: true,
    };
  }

  // 2. Manage Social Media Accounts
  async getAccounts() {
    return this.prisma.socialMediaAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAccount(data: any) {
    return this.prisma.socialMediaAccount.create({
      data: {
        platform: data.platform,
        username: data.username,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isSimulated: data.isSimulated !== undefined ? data.isSimulated : true,
        credentials: data.credentials || {},
      },
    });
  }

  async updateAccount(id: number, data: any) {
    return this.prisma.socialMediaAccount.update({
      where: { id },
      data: {
        platform: data.platform,
        username: data.username,
        isActive: data.isActive,
        isSimulated: data.isSimulated,
        credentials: data.credentials,
      },
    });
  }

  async deleteAccount(id: number) {
    return this.prisma.socialMediaAccount.delete({
      where: { id },
    });
  }

  // 3. Manage Posts
  async getPosts() {
    return this.prisma.socialMediaPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPost(data: any) {
    let imageUrl = data.imageUrl;
    let videoUrl = data.videoUrl;

    if (imageUrl && imageUrl.startsWith('data:')) {
      imageUrl = this.saveBase64Media(imageUrl, 'manual-image');
    }
    if (videoUrl && videoUrl.startsWith('data:')) {
      videoUrl = this.saveBase64Media(videoUrl, 'manual-video');
    }

    return this.prisma.socialMediaPost.create({
      data: {
        platform: data.platform,
        prompt: data.prompt || '',
        caption: data.caption,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        postType: data.postType || 'POST',
        status: data.status || 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        accountId: data.accountId ? parseInt(data.accountId, 10) : null,
      },
    });
  }

  async updatePost(id: number, data: any) {
    return this.prisma.socialMediaPost.update({
      where: { id },
      data: {
        caption: data.caption,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        postType: data.postType,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        errorMessage: data.errorMessage,
        accountId: data.accountId ? parseInt(data.accountId, 10) : null,
      },
    });
  }

  async deletePost(id: number) {
    return this.prisma.socialMediaPost.delete({
      where: { id },
    });
  }

  // 4. Publish a post immediately (simulate or send)
  async publishPost(id: number) {
    const post = await this.prisma.socialMediaPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new Error('Gönderi bulunamadı.');
    }

    // Set post status to PUBLISHING immediately in the database
    const updatedPost = await this.prisma.socialMediaPost.update({
      where: { id },
      data: {
        status: 'PUBLISHING',
        errorMessage: null,
      },
    });

    // Run the actual publishing process in the background
    this.publishPostInBackground(id).catch((err) => {
      this.logger.error(`Error in background publishPost for post ID ${id}:`, err);
    });

    return updatedPost;
  }

  private async updatePostProgress(id: number, message: string) {
    this.logger.log(`[Post #${id}] ${message}`);
    await this.prisma.socialMediaPost.update({
      where: { id },
      data: {
        errorMessage: message,
      },
    });
  }

  // Actual publishing logic run in the background
  async publishPostInBackground(id: number) {
    const post = await this.prisma.socialMediaPost.findUnique({
      where: { id },
    });

    if (!post) {
      this.logger.error(`Post with ID ${id} not found for background publishing.`);
      return;
    }

    try {
      await this.updatePostProgress(id, 'Paylaşım başlatıldı, hesap bilgileri sorgulanıyor...');

      // Find account for this platform
      let account = null;
      if (post.accountId) {
        account = await this.prisma.socialMediaAccount.findFirst({
          where: { id: post.accountId, isActive: true },
        });
      } else {
        account = await this.prisma.socialMediaAccount.findFirst({
          where: { platform: post.platform, isActive: true },
        });
      }

      if (!account) {
        throw new Error(`${post.platform} için aktif bir sosyal medya hesabı bulunamadı.`);
      }

      if (account.isSimulated) {
        // Simulated Publish
        await this.updatePostProgress(id, 'Simülasyon modunda paylaşılıyor...');
        this.logger.log(`[SIMULATED] Posting to ${post.platform} for account ${account.username}`);
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network latency
        
        const msg = `✅ [SİMÜLASYON] <b>YENİ GÖNDERİ PAYLAŞILDI</b>\n\n` +
          `<b>Platform:</b> ${post.platform}\n` +
          `<b>Hesap:</b> ${account.username}\n` +
          `<b>Gönderi Türü:</b> ${post.postType}\n` +
          `<b>Metin:</b>\n<i>${post.caption}</i>\n` +
          (post.imageUrl ? `\n🖼️ Görsel Ekli` : '') +
          (post.videoUrl ? `\n🎥 Video Ekli` : '');
        await this.sendTelegramNotification(msg);

        await this.prisma.socialMediaPost.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            errorMessage: null,
          },
        });
        return;
      } else {
        // Real API integrations
        await this.updatePostProgress(id, `${post.platform} API bağlantısı kuruluyor...`);
        this.logger.log(`[REAL] Attempting to publish to ${post.platform} API...`);
        const credentials: any = account.credentials;
        const accessToken = credentials?.accessToken?.trim();
        const pageId = credentials?.pageId?.trim();

        if (!accessToken) {
          throw new Error('Access Token eksik. Gerçek gönderi paylaşılamadı.');
        }

        if (post.platform === 'FACEBOOK') {
          await this.updatePostProgress(id, 'Facebook entegrasyonu başlatıldı...');
          if (!pageId) {
            throw new Error('Sayfa Kimliği (Page ID) eksik. Facebook paylaşımı yapılamadı.');
          }

          const imageUrl = post.imageUrl ? this.getAbsoluteUrl(post.imageUrl) : null;
          const videoUrl = post.videoUrl ? this.getAbsoluteUrl(post.videoUrl) : null;

          const isLocalMedia = (url?: string) => url && (url.includes('localhost') || url.includes('127.0.0.1'));
          if (isLocalMedia(imageUrl) || isLocalMedia(videoUrl)) {
            throw new Error(
              'Görsel veya video yerel sunucuda (localhost) veya veri formatında barındırılıyor. ' +
              'Meta API\'lerinin dosyayı indirebilmesi için internete açık, genel bir URL (örn. ngrok tüneli veya sunucu URL\'si) gereklidir.'
            );
          }

          if (process.env.NODE_ENV === 'development' && !process.env.BACKEND_URL && (post.imageUrl || post.videoUrl)) {
             throw new Error(
               'Geliştirme (development) modundasınız ancak .env dosyasında BACKEND_URL tanımlanmamış. ' +
               'Yapay zeka ile yerel olarak üretilen görseller canlı sunucuda (api.edirnego.com) bulunmadığı için Meta tarafından indirilemez ve medya işleme zaman aşımına uğrar. ' +
               'Lütfen ngrok kullanıp .env dosyanıza BACKEND_URL=https://<ngrok-url>.ngrok-free.app ekleyin.'
             );
          }

          let fbUrl = `https://graph.facebook.com/v18.0/${pageId}/feed`;
          let body: any = {
            message: post.caption,
            access_token: accessToken,
          };

          const isPublicMedia = (url?: string) => url && url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1');

          if (isPublicMedia(imageUrl)) {
            await this.updatePostProgress(id, 'Facebook: Görsel gönderisi hazırlanıyor...');
            fbUrl = `https://graph.facebook.com/v18.0/${pageId}/photos`;
            body = {
              url: imageUrl,
              message: post.caption,
              access_token: accessToken,
            };
          } else if (isPublicMedia(videoUrl)) {
            await this.updatePostProgress(id, 'Facebook: Video gönderisi hazırlanıyor...');
            fbUrl = `https://graph.facebook.com/v18.0/${pageId}/videos`;
            body = {
              file_url: videoUrl,
              description: post.caption,
              access_token: accessToken,
            };
          } else {
            await this.updatePostProgress(id, 'Facebook: Metin gönderisi hazırlanıyor...');
          }

          await this.updatePostProgress(id, 'Facebook API\'ye gönderiliyor...');
          const fbResponse = await fetch(fbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const fbData = await fbResponse.json();
          if (!fbResponse.ok) {
            throw new Error(`Facebook API Hatası: ${fbData?.error?.message || fbResponse.statusText}`);
          }

          const msg = `✅ <b>FACEBOOK GÖNDERİSİ PAYLAŞILDI</b>\n\n` +
            `<b>Hesap:</b> ${account.username}\n` +
            `<b>Post ID:</b> #${id}\n` +
            `<b>Metin:</b>\n<i>${post.caption}</i>\n` +
            (post.imageUrl ? `\n🖼️ Görsel Ekli` : '') +
            (post.videoUrl ? `\n🎥 Video Ekli` : '');
          await this.sendTelegramNotification(msg);

          await this.prisma.socialMediaPost.update({
            where: { id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
            },
          });
          return;
        }

        if (post.platform === 'INSTAGRAM') {
          await this.updatePostProgress(id, 'Instagram entegrasyonu başlatıldı...');
          let instagramBusinessAccountId = credentials?.instagramBusinessAccountId;
          
          if (!instagramBusinessAccountId && pageId) {
            await this.updatePostProgress(id, 'Instagram Business Account ID sorgulanıyor...');
            // Retrieve instagramBusinessAccountId on the fly
            const pageInfoRes = await fetch(
              `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
            );
            if (pageInfoRes.ok) {
              const pageInfo = await pageInfoRes.json();
              instagramBusinessAccountId = pageInfo?.instagram_business_account?.id;
              
              if (instagramBusinessAccountId) {
                // Save it so we don't have to fetch next time
                await this.prisma.socialMediaAccount.update({
                  where: { id: account.id },
                  data: {
                    credentials: {
                      ...credentials,
                      instagramBusinessAccountId,
                    },
                  },
                });
              }
            }
          }

          if (!instagramBusinessAccountId) {
            throw new Error(
              'Instagram İşletme Hesabı (Business Account ID) bulunamadı. ' +
              'Lütfen Facebook Sayfanız ile Instagram Hesabınızın birbirine bağlı olduğundan emin olun.'
            );
          }

          const imageUrl = post.imageUrl ? this.getAbsoluteUrl(post.imageUrl) : null;
          const videoUrl = post.videoUrl ? this.getAbsoluteUrl(post.videoUrl) : null;

          const isLocalMedia = (url?: string) => url && (url.includes('localhost') || url.includes('127.0.0.1'));
          if (isLocalMedia(imageUrl) || isLocalMedia(videoUrl)) {
            throw new Error(
              'Görsel veya video yerel sunucuda (localhost) veya veri formatında barındırılıyor. ' +
              'Instagram API\'sinin medyayı indirebilmesi için genel, internete açık bir URL gereklidir.'
            );
          }

          if (process.env.NODE_ENV === 'development' && !process.env.BACKEND_URL && (post.imageUrl || post.videoUrl)) {
             throw new Error(
               'Geliştirme (development) modundasınız ancak .env dosyasında BACKEND_URL tanımlanmamış. ' +
               'Yapay zeka ile yerel olarak üretilen görseller canlı sunucuda (api.edirnego.com) bulunmadığı için Meta tarafından indirilemez ve medya işleme zaman aşımına uğrar. ' +
               'Lütfen ngrok kullanıp .env dosyanıza BACKEND_URL=https://<ngrok-url>.ngrok-free.app ekleyin.'
             );
          }

          // Helper to publish to Instagram
          const publishToInstagram = async (type: 'POST' | 'STORY') => {
            await this.updatePostProgress(id, `Instagram: Medya konteyneri oluşturuluyor (${type === 'STORY' ? 'Hikaye' : 'Gönderi'})...`);
            const mediaContainerUrl = `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media`;
            const containerBody: any = {
              access_token: accessToken,
            };

            if (type === 'STORY') {
              containerBody.media_type = 'STORIES';
              if (videoUrl) {
                containerBody.video_url = videoUrl;
              } else if (imageUrl) {
                let storyImageUrl = imageUrl;
                if (post.caption && post.caption.trim()) {
                  try {
                    await this.updatePostProgress(id, 'Instagram: Hikaye görseli üzerine metin yazılıyor...');
                    const relativeProcessedPath = await this.overlayTextOnImage(post.imageUrl, post.caption);
                    if (relativeProcessedPath) {
                      storyImageUrl = this.getAbsoluteUrl(relativeProcessedPath);
                    }
                  } catch (err) {
                    this.logger.error(`Hikaye görseline metin ekleme başarısız (orijinal kullanılacak): ${err.message}`);
                  }
                }
                containerBody.image_url = storyImageUrl;
              } else {
                throw new Error('Hikaye paylaşımı için bir görsel veya video gereklidir.');
              }
            } else {
              // Feed Post
              if (videoUrl) {
                containerBody.media_type = 'REELS';
                containerBody.video_url = videoUrl;
                containerBody.caption = post.caption;
              } else if (imageUrl) {
                containerBody.image_url = imageUrl;
                containerBody.caption = post.caption;
              } else {
                throw new Error('Gönderi paylaşımı için en az bir görsel veya video gereklidir.');
              }
            }

            const containerRes = await fetch(mediaContainerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(containerBody),
            });

            const containerData = await containerRes.json();
            if (!containerRes.ok) {
              throw new Error(`Instagram Konteyner Hatası (${type}): ${containerData?.error?.message || containerRes.statusText}`);
            }

            const creationId = containerData.id;

            // Wait for media processing (both image and video)
            let status = 'IN_PROGRESS';
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes max
            while (status !== 'FINISHED' && attempts < maxAttempts) {
              await this.updatePostProgress(
                id,
                `Instagram: Medya işleniyor (Deneme ${attempts + 1}/${maxAttempts})...`
              );
              await new Promise(resolve => setTimeout(resolve, 5000));
              const checkRes = await fetch(
                `https://graph.facebook.com/v18.0/${creationId}?fields=status_code,status&access_token=${accessToken}`
              );
              if (checkRes.ok) {
                const checkData = await checkRes.json();
                status = checkData.status_code || 'FINISHED';
                if (status === 'ERROR') {
                  throw new Error(`Instagram medya işleme hatası: ${checkData.status || 'Bilinmeyen hata'}`);
                }
              } else {
                const errData = await checkRes.json().catch(() => ({}));
                const errMsg = errData?.error?.message || `Status: ${checkRes.status}`;
                this.logger.error(`Instagram container status check failed: ${errMsg}`);
                throw new Error(`Instagram durum kontrolü başarısız: ${errMsg}`);
              }
              attempts++;
            }
            if (status !== 'FINISHED') {
              throw new Error('Instagram medya işleme zaman aşımına uğradı. Lütfen tekrar deneyin.');
            }

            // Publish
            await this.updatePostProgress(id, `Instagram: Medya yayınlanıyor (${type === 'STORY' ? 'Hikaye' : 'Gönderi'})...`);
            const publishUrl = `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media_publish`;
            const publishRes = await fetch(publishUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creation_id: creationId,
                access_token: accessToken,
              }),
            });

            const publishData = await publishRes.json();
            if (!publishRes.ok) {
              throw new Error(`Instagram Paylaşım Hatası (${type}): ${publishData?.error?.message || publishRes.statusText}`);
            }
          };

          if (post.postType === 'BOTH') {
            await publishToInstagram('POST');
            await publishToInstagram('STORY');
          } else {
            await publishToInstagram(post.postType as 'POST' | 'STORY');
          }

          const msg = `✅ <b>INSTAGRAM GÖNDERİSİ PAYLAŞILDI</b>\n\n` +
            `<b>Hesap:</b> ${account.username}\n` +
            `<b>Post ID:</b> #${id}\n` +
            `<b>Metin:</b>\n<i>${post.caption}</i>\n` +
            (post.imageUrl ? `\n🖼️ Görsel Ekli` : '') +
            (post.videoUrl ? `\n🎥 Video Ekli` : '');
          await this.sendTelegramNotification(msg);

          await this.prisma.socialMediaPost.update({
            where: { id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
            },
          });
          return;
        }

        // TikTok or others
        throw new Error(`${post.platform} için gerçek paylaşım entegrasyonu henüz aktif değil.`);
      }
    } catch (error) {
      this.logger.error(`Gönderi paylaşımında hata (${post.platform}):`, error);
      
      const isTokenErr = error.message.toLowerCase().includes('token') || 
                         error.message.toLowerCase().includes('permission') || 
                         error.message.toLowerCase().includes('session') ||
                         error.message.toLowerCase().includes('authoriz') ||
                         error.message.toLowerCase().includes('190');
      
      const errMsgHeader = isTokenErr 
        ? `⚠️ <b>HESAP ACCESS TOKEN SÜRESİ DOLDU VEYA YETKİ HATASI</b>`
        : `❌ <b>GÖNDERİ PAYLAŞILAMADI (HATA)</b>`;

      const postPreview = post.caption ? (post.caption.length > 80 ? post.caption.substring(0, 80) + '...' : post.caption) : '(Metinsiz Gönderi)';

      const notificationMsg = `${errMsgHeader}\n\n` +
        `<b>Gönderi ID:</b> #${id}\n` +
        `<b>Platform:</b> ${post.platform}\n` +
        `<b>Gönderi İçeriği:</b> <i>"${postPreview}"</i>\n` +
        `<b>Hata Konusu/Nedeni:</b> <code>${error.message}</code>\n\n` +
        `💡 Lütfen Hesap Tanımları sekmesini kontrol edin veya yerel sunucu/ngrok bağlantınızı doğrulayın.`;
      
      await this.sendTelegramNotification(notificationMsg);

      await this.prisma.socialMediaPost.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
    }
  }

  // 4b. Test connection to a social media platform API
  async testConnection(id: number) {
    const account = await this.prisma.socialMediaAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new Error('Hesap bulunamadı.');
    }

    if (account.isSimulated) {
      return {
        success: true,
        message: 'Simülasyon bağlantısı başarılı! Gerçek API isteği gönderilmeyecek.',
      };
    }

    const credentials: any = account.credentials;
    const accessToken = credentials?.accessToken?.trim();
    const pageId = credentials?.pageId?.trim();

    if (!accessToken) {
      return {
        success: false,
        message: 'Access Token bulunamadı. Lütfen kimlik bilgilerini kontrol edin.',
      };
    }

    try {
      if (account.platform === 'FACEBOOK' || account.platform === 'INSTAGRAM') {
        if (!pageId) {
          return {
            success: false,
            message: 'Facebook/Instagram bağlantısı için Page ID (Sayfa Kimliği) gereklidir.',
          };
        }

        const fields = account.platform === 'INSTAGRAM' ? 'name,instagram_business_account' : 'name';

        // Call Meta Graph API to verify the page access token
        let response = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?fields=${fields}&access_token=${accessToken}`,
        );

        let data = await response.json();
        let wasTokenExchanged = false;
        let activeToken = accessToken;

        // Fallback 1: If querying by pageId fails due to permissions, it might be a User Access Token.
        // Let's try querying "me/accounts" to find the Page Access Token.
        if (!response.ok) {
          const isPermissionErr = data?.error?.message?.includes('permissions') || 
                                  data?.error?.message?.includes('Unsupported get request') ||
                                  data?.error?.message?.includes('does not exist');
          if (isPermissionErr) {
            try {
              const accountsResponse = await fetch(
                `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
              );
              if (accountsResponse.ok) {
                const accountsData = await accountsResponse.json();
                const matchedPage = accountsData?.data?.find(
                  (p: any) => String(p.id) === String(pageId),
                );

                if (matchedPage?.access_token) {
                  const pageAccessToken = matchedPage.access_token;
                  const pageResponse = await fetch(
                    `https://graph.facebook.com/v18.0/${pageId}?fields=${fields}&access_token=${pageAccessToken}`,
                  );
                  if (pageResponse.ok) {
                    response = pageResponse;
                    data = await pageResponse.json();
                    wasTokenExchanged = true;
                    activeToken = pageAccessToken;
                  }
                }
              }
            } catch (err) {
              this.logger.error('Token takası sırasında hata oluştu:', err);
            }
          }
        }

        // Fallback 2: If querying by pageId still fails, try querying "/me" 
        // because if they used a Page Access Token, "/me" refers to the page itself.
        if (!response.ok) {
          const isPermissionErr = data?.error?.message?.includes('permissions') || 
                                  data?.error?.message?.includes('Unsupported get request') ||
                                  data?.error?.message?.includes('does not exist');
          if (isPermissionErr) {
            try {
              const fallbackResponse = await fetch(
                `https://graph.facebook.com/v18.0/me?fields=${fields},id&access_token=${accessToken}`,
              );
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (String(fallbackData.id) === String(pageId) || fallbackData.name) {
                  response = fallbackResponse;
                  data = fallbackData;
                }
              }
            } catch (err) {
              this.logger.error('Fallback /me sorgusu sırasında hata oluştu:', err);
            }
          }
        }

        if (!response.ok) {
          const errMsg = data?.error?.message || 'Meta API doğrulama hatası.';
          
          const isTokenErr = errMsg.toLowerCase().includes('token') || 
                             errMsg.toLowerCase().includes('permission') || 
                             errMsg.toLowerCase().includes('session') ||
                             errMsg.toLowerCase().includes('190');
          if (isTokenErr) {
            this.sendTelegramNotification(
              `⚠️ <b>HESAP BAĞLANTI TESTİ BAŞARISIZ (ACCESS TOKEN EXPIRED)</b>\n\n` +
              `<b>Hesap:</b> ${account.username} (${account.platform})\n` +
              `<b>Hata:</b> <code>${errMsg}</code>\n\n` +
              `💡 Lütfen yeni bir sayfa erişim jetonu (Page Access Token) alıp hesabı güncelleyin.`
            ).catch(err => this.logger.error('Failed to send Telegram alert for connection failure:', err));
          }

          let helpfulTips = '';
          if (errMsg.includes('Unsupported get request') || errMsg.includes('permissions') || errMsg.includes('does not exist')) {
            helpfulTips = '\n\n💡 ÇÖZÜM REHBERİ: Bu hata genellikle şu nedenlerden kaynaklanır:\n' +
              '1. Girdiğiniz Access Token bir "Kullanıcı" tokenı olabilir. Facebook/Instagram API\'leri için "Sayfa (Page) Access Token" kullanmanız gereklidir.\n' +
              '2. Girdiğiniz Access Token\'ın bu Sayfa ID\'sine (' + pageId + ') erişim izni yok. Facebook Developers/Graph Explorer panelinden token alırken "pages_read_engagement", "pages_show_list" ve "instagram_basic" izinlerini verdiğinizden emin olun.\n' +
              '3. Facebook Uygulamanız (Meta App) "Geliştirme (Development)" modundaysa, sayfayı yöneten kişisel Facebook hesabının Meta App panelinde "Roller (Roles) -> Test Kullanıcıları (Testers)" veya Geliştiriciler (Developers) altına eklenmiş olması gerekir.';
          }

          return {
            success: false,
            message: `Bağlantı hatası: ${errMsg}${helpfulTips}`,
          };
        }

        // Save updated credentials if token was exchanged or if instagram business account ID is found
        const instagramBusinessAccountId = data.instagram_business_account?.id;
        const needsUpdate = wasTokenExchanged || 
                            (instagramBusinessAccountId && credentials.instagramBusinessAccountId !== instagramBusinessAccountId);
        
        if (needsUpdate) {
          await this.prisma.socialMediaAccount.update({
            where: { id },
            data: {
              credentials: {
                ...credentials,
                accessToken: activeToken,
                ...(instagramBusinessAccountId && { instagramBusinessAccountId }),
              },
            },
          });
        }

        if (account.platform === 'INSTAGRAM' && !data.instagram_business_account) {
          return {
            success: false,
            message: `Doğrulama Başarılı ancak bu Facebook sayfasına bağlı bir Instagram İşletme Hesabı (Business Account) bulunamadı.`,
          };
        }

        return {
          success: true,
          message: wasTokenExchanged
            ? `Bağlantı Başarılı! Girdiğiniz Kullanıcı Token'ı, "${data.name}" Sayfa Erişim Token'ı (Page Access Token) ile otomatik olarak değiştirildi ve kaydedildi.`
            : `Bağlantı Başarılı! Meta Sayfası: "${data.name}" doğrulandı.`,
        };
      }

      // TikTok or others
      return {
        success: true,
        message: `${account.platform} API bağlantısı simüle edildi.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Sunucu bağlantı hatası: ${error.message}`,
      };
    }
  }

  // 5. Cron job to process scheduled posts (runs every minute)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    const now = new Date();
    const scheduledPosts = await this.prisma.socialMediaPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
    });

    if (scheduledPosts.length === 0) {
      return;
    }

    this.logger.log(`${scheduledPosts.length} adet zamanlanmış gönderi işleniyor...`);

    for (const post of scheduledPosts) {
      try {
        await this.publishPost(post.id);
      } catch (error) {
        this.logger.error(`Zamanlanmış gönderi (#${post.id}) paylaşılamadı:`, error);
      }
    }
  }

  // --- Campaigns CRUD ---
  async getCampaigns() {
    return this.prisma.socialMediaCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(data: any) {
    let imageUrl = data.imageUrl;
    if (imageUrl && imageUrl.startsWith('data:')) {
      imageUrl = this.saveBase64Media(imageUrl, 'campaign-image');
    }

    return this.prisma.socialMediaCampaign.create({
      data: {
        title: data.title,
        prompt: data.prompt,
        platform: data.platform,
        postType: data.postType || 'POST',
        frequency: data.frequency || 'DAILY',
        timeOfDay: data.timeOfDay || '09:00',
        isActive: data.isActive !== undefined ? data.isActive : true,
        imageUrl: imageUrl || null,
      },
    });
  }

  async updateCampaign(id: number, data: any) {
    let imageUrl = data.imageUrl;
    if (imageUrl && imageUrl.startsWith('data:')) {
      imageUrl = this.saveBase64Media(imageUrl, 'campaign-image');
    }

    return this.prisma.socialMediaCampaign.update({
      where: { id },
      data: {
        title: data.title,
        prompt: data.prompt,
        platform: data.platform,
        postType: data.postType,
        frequency: data.frequency,
        timeOfDay: data.timeOfDay,
        isActive: data.isActive,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
      },
    });
  }

  async deleteCampaign(id: number) {
    return this.prisma.socialMediaCampaign.delete({
      where: { id },
    });
  }

  async toggleCampaign(id: number) {
    const campaign = await this.prisma.socialMediaCampaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new Error('Kampanya bulunamadı.');
    }
    return this.prisma.socialMediaCampaign.update({
      where: { id },
      data: {
        isActive: !campaign.isActive,
      },
    });
  }

  async testTriggerCampaign(id: number) {
    const campaign = await this.prisma.socialMediaCampaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new Error('Kampanya bulunamadı.');
    }

    // Load default providers and models from global settings
    const aiSettings = await this.getAiSettings();
    const textProvider = aiSettings.defaultTextProvider || 'gemini';
    const textModel = aiSettings.defaultTextModel || 'gemini-2.5-flash';
    const imageProvider = aiSettings.defaultImageProvider || 'huggingface';
    const imageModel = aiSettings.defaultImageModel || 'flux';

    // Generate content
    const genResult = await this.generatePost(
      campaign.prompt,
      campaign.platform,
      'Samimi',
      textProvider,
      imageProvider,
      'simulation',
      campaign.imageUrl ? false : true, // Do not generate AI image if static image is set
      false, // Include video
      campaign.postType,
      textModel,
      imageModel
    );

    // Create the post database record with status PENDING_APPROVAL
    const newPost = await this.prisma.socialMediaPost.create({
      data: {
        platform: campaign.platform,
        prompt: campaign.prompt,
        caption: genResult.caption,
        imageUrl: campaign.imageUrl || genResult.imageUrl || null,
        videoUrl: null,
        postType: campaign.postType,
        status: 'PENDING_APPROVAL',
        campaignId: campaign.id,
      },
    });

    let mediaLink = '';
    if (newPost.imageUrl) {
      mediaLink = `\n🖼️ <b>Görsel:</b> <a href="${this.getAbsoluteUrl(newPost.imageUrl)}">Görüntüle</a>\n`;
    }

    const campaignMsg = `🔔 <b>ZAMANLANMIŞ GÖREV TEST ÇALIŞTIRMASI (ONAY BEKLİYOR)</b>\n\n` +
      `<b>Kampanya:</b> ${campaign.title}\n` +
      `<b>Platform:</b> ${campaign.platform}\n` +
      `<b>Tür:</b> ${campaign.postType}\n` +
      `<b>Konu/Talimat:</b> <i>"${campaign.prompt}"</i>\n\n` +
      `<b>Metin:</b>\n<i>${newPost.caption}</i>\n` +
      mediaLink;

    try {
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Onayla ve Paylaş', callback_data: `approve_publish_${newPost.id}` },
            { text: '❌ Reddet/Sil', callback_data: `reject_delete_${newPost.id}` },
          ],
        ],
      };
      await this.sendTelegramNotification(campaignMsg, replyMarkup);
    } catch (tgError) {
      this.logger.error('Telegram notification failed for campaign test trigger:', tgError);
    }

    return newPost;
  }


  // Cron job for campaigns (runs every minute)
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCampaigns() {
    const now = new Date();
    
    // Turkey/Local time (Europe/Istanbul) HH:MM format
    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const hours = timeParts.find(p => p.type === 'hour')?.value || '00';
    const minutes = timeParts.find(p => p.type === 'minute')?.value || '00';
    const timeStr = `${hours}:${minutes}`;

    const activeCampaigns = await this.prisma.socialMediaCampaign.findMany({
      where: {
        isActive: true,
        timeOfDay: timeStr,
      },
    });

    if (activeCampaigns.length === 0) {
      return;
    }

    this.logger.log(`${activeCampaigns.length} adet aktif kampanya kontrol ediliyor. Saat: ${timeStr}`);

    const getTurkeyDateStr = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      return `${y}-${m}-${d}`;
    };

    for (const campaign of activeCampaigns) {
      try {
        let shouldRun = false;
        if (!campaign.lastRunAt) {
          shouldRun = true;
        } else {
          const lastRun = new Date(campaign.lastRunAt);
          const diffMs = now.getTime() - lastRun.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (campaign.frequency === 'DAILY') {
            const isSameDay = getTurkeyDateStr(lastRun) === getTurkeyDateStr(now);
            if (!isSameDay) {
              shouldRun = true;
            }
          } else if (campaign.frequency === 'WEEKLY') {
            if (diffDays >= 6) {
              shouldRun = true;
            }
          }
        }

        if (!shouldRun) {
          continue;
        }

        this.logger.log(`Kampanya tetiklendi: "${campaign.title}" (#${campaign.id})`);

        // Mark run immediately to prevent concurrency double runs
        await this.prisma.socialMediaCampaign.update({
          where: { id: campaign.id },
          data: { lastRunAt: now },
        });

        // Load default providers and models from global settings
        const aiSettings = await this.getAiSettings();
        const textProvider = aiSettings.defaultTextProvider || 'gemini';
        const textModel = aiSettings.defaultTextModel || 'gemini-2.5-flash';
        const imageProvider = aiSettings.defaultImageProvider || 'huggingface';
        const imageModel = aiSettings.defaultImageModel || 'flux';

        // Generate content
        this.logger.log(`Kampanya postu üretiliyor... Prompt: "${campaign.prompt}"`);
        const genResult = await this.generatePost(
          campaign.prompt,
          campaign.platform,
          'Samimi',
          textProvider,
          imageProvider,
          'simulation',
          campaign.imageUrl ? false : true, // Do not generate AI image if static image is set
          false, // Include video
          campaign.postType,
          textModel,
          imageModel
        );

        // Create the post database record with status PENDING_APPROVAL
        const newPost = await this.prisma.socialMediaPost.create({
          data: {
            platform: campaign.platform,
            prompt: campaign.prompt,
            caption: genResult.caption,
            imageUrl: campaign.imageUrl || genResult.imageUrl || null,
            videoUrl: null,
            postType: campaign.postType,
            status: 'PENDING_APPROVAL',
            campaignId: campaign.id,
          },
        });

        this.logger.log(`Kampanya postu onay bekliyor... Post ID: ${newPost.id}`);

        let mediaLink = '';
        if (newPost.imageUrl) {
          mediaLink = `\n🖼️ <b>Görsel:</b> <a href="${this.getAbsoluteUrl(newPost.imageUrl)}">Görüntüle</a>\n`;
        }

        const campaignMsg = `🔔 <b>ZAMANLANMIŞ GÖREV (ONAY BEKLİYOR)</b>\n\n` +
          `<b>Kampanya:</b> ${campaign.title}\n` +
          `<b>Platform:</b> ${campaign.platform}\n` +
          `<b>Tür:</b> ${campaign.postType}\n` +
          `<b>Konu/Talimat:</b> <i>"${campaign.prompt}"</i>\n\n` +
          `<b>Metin:</b>\n<i>${newPost.caption}</i>\n` +
          mediaLink;

        // Interactive inline buttons for Telegram
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Onayla ve Paylaş', callback_data: `approve_post_${newPost.id}` },
              { text: '❌ Reddet', callback_data: `reject_post_${newPost.id}` }
            ]
          ]
        };

        await this.sendTelegramNotification(campaignMsg, replyMarkup);

      } catch (error) {
        this.logger.error(`Kampanya (#${campaign.id}) yürütülürken hata:`, error);
        const errMsg = `❌ <b>KAMPANYA YÜRÜTÜLÜRKEN HATA OLUŞTU</b>\n\n` +
          `<b>Kampanya:</b> ${campaign.title} (#${campaign.id})\n` +
          `<b>Platform:</b> ${campaign.platform}\n` +
          `<b>Hata Nedeni:</b> <code>${error.message}</code>`;
        await this.sendTelegramNotification(errMsg);
      }
    }
  }

  // --- Telegram Settings CRUD & Notifications ---
  async getTelegramSetting() {
    let setting = await this.prisma.telegramSetting.findFirst();
    if (!setting) {
      // Return a blank template
      setting = {
        id: 0,
        botToken: '',
        chatId: '',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return setting;
  }

  async saveTelegramSetting(data: { botToken: string; chatId: string; isActive: boolean }) {
    const existing = await this.prisma.telegramSetting.findFirst();
    if (existing) {
      return this.prisma.telegramSetting.update({
        where: { id: existing.id },
        data: {
          botToken: data.botToken.trim(),
          chatId: data.chatId.trim(),
          isActive: data.isActive,
        },
      });
    } else {
      return this.prisma.telegramSetting.create({
        data: {
          botToken: data.botToken.trim(),
          chatId: data.chatId.trim(),
          isActive: data.isActive,
        },
      });
    }
  }

  async sendTelegramNotification(message: string, replyMarkup?: any) {
    try {
      const setting = await this.prisma.telegramSetting.findFirst();
      if (!setting || !setting.isActive || !setting.botToken || !setting.chatId) {
        return;
      }

      const url = `https://api.telegram.org/bot${setting.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: setting.chatId,
          text: message,
          parse_mode: 'HTML',
          ...(replyMarkup && { reply_markup: replyMarkup }),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Telegram bildirim gönderme hatası: ${errText}`);
      }
    } catch (err) {
      this.logger.error('Telegram bildirim fonksiyonunda beklenmeyen hata:', err);
    }
  }

  @Cron('*/5 * * * * *')
  async handleTelegramPolling() {
    if (this.isPollingTelegram) return;
    this.isPollingTelegram = true;

    try {
      const setting = await this.prisma.telegramSetting.findFirst();
      if (!setting || !setting.isActive || !setting.botToken) {
        this.isPollingTelegram = false;
        return;
      }

      const url = `https://api.telegram.org/bot${setting.botToken}/getUpdates?offset=${this.telegramOffset}&timeout=3`;
      const response = await fetch(url);
      if (!response.ok) {
        this.isPollingTelegram = false;
        return;
      }

      const data = await response.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          this.telegramOffset = update.update_id + 1;

          if (update.callback_query) {
            const query = update.callback_query;
            const callbackData = query.data;
            const callbackQueryId = query.id;
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;

            if (callbackData.startsWith('approve_post_')) {
              const postId = parseInt(callbackData.replace('approve_post_', ''), 10);
              
              await fetch(`https://api.telegram.org/bot${setting.botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: callbackQueryId,
                  text: 'Gönderi onaylandı, paylaşılıyor...',
                }),
              });

              try {
                const post = await this.prisma.socialMediaPost.findUnique({ where: { id: postId } });
                if (!post) {
                  throw new Error('Gönderi bulunamadı.');
                }
                if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') {
                  await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      message_id: messageId,
                      text: `✅ <b>Gönderi zaten paylaşıldı veya paylaşım sırasında.</b>\n\nPlatform: ${post.platform}\nMetin: ${post.caption}`,
                      parse_mode: 'HTML',
                    }),
                  });
                  continue;
                }

                await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: `⌛ <b>Gönderi onaylandı ve paylaşım başlatıldı...</b>\n\n<b>Platform:</b> ${post.platform}\n<b>Tür:</b> ${post.postType}\n<b>Metin:</b>\n<i>${post.caption}</i>`,
                    parse_mode: 'HTML',
                  }),
                });

                await this.publishPost(postId);
              } catch (err) {
                this.logger.error(`Telegram onayıyla paylaşım başarısız (Post #${postId}):`, err);
                await fetch(`https://api.telegram.org/bot${setting.botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `❌ <b>Hata:</b> Post #${postId} paylaşılamadı. Detay: ${err.message}`,
                    parse_mode: 'HTML',
                  }),
                });
              }
            } else if (callbackData.startsWith('reject_post_')) {
              const postId = parseInt(callbackData.replace('reject_post_', ''), 10);
              
              await fetch(`https://api.telegram.org/bot${setting.botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: callbackQueryId,
                  text: 'Gönderi reddedildi.',
                }),
              });

              try {
                const post = await this.prisma.socialMediaPost.findUnique({ where: { id: postId } });
                if (post) {
                  await this.prisma.socialMediaPost.update({
                    where: { id: postId },
                    data: { status: 'REJECTED' },
                  });
                  
                  await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      message_id: messageId,
                      text: `❌ <b>Gönderi Reddedildi (Paylaşım İptal Edildi).</b>\n\n<b>Platform:</b> ${post.platform}\n<b>Metin:</b>\n<i>${post.caption}</i>`,
                      parse_mode: 'HTML',
                    }),
                  });
                }
              } catch (err) {
                this.logger.error(`Post reddetme hatası:`, err);
              }
            }
          }
        }
      }
    } catch (err) {
      this.logger.error('Telegram polling error:', err);
    } finally {
      this.isPollingTelegram = false;
    }
  }

  async sendTelegramTestMessage() {
    try {
      const setting = await this.prisma.telegramSetting.findFirst();
      if (!setting || !setting.botToken || !setting.chatId) {
        return {
          success: false,
          message: 'Telegram ayarları henüz yapılandırılmamış veya eksik. Lütfen önce bilgileri kaydedin.',
        };
      }

      const testMsg = `🔔 <b>SMYP Telegram Bildirim Testi</b>\n\nBu mesaj Telegram entegrasyonunuzun başarıyla çalıştığını göstermektedir.\n\n📅 Tarih: ${new Date().toLocaleString('tr-TR')}`;
      
      const url = `https://api.telegram.org/bot${setting.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: setting.chatId,
          text: testMsg,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed.description || errText;
        } catch {}
        return {
          success: false,
          message: `Telegram Bildirim Gönderimi Başarısız: ${detail}`,
        };
      }

      return { success: true, message: 'Test mesajı Telegram hesabınıza başarıyla gönderildi.' };
    } catch (error) {
      return {
        success: false,
        message: `Sunucu Hatası: ${error.message}`,
      };
    }
  }

  private checkAiTokenError(error: Error, provider: string) {
    const msg = error.message.toLowerCase();
    const isTokenQuotaError = msg.includes('quota') || 
                              msg.includes('limit') || 
                              msg.includes('key') || 
                              msg.includes('token') || 
                              msg.includes('429') || 
                              msg.includes('401') || 
                              msg.includes('exhausted') || 
                              msg.includes('billing') ||
                              msg.includes('unauthorized') ||
                              msg.includes('forbidden');
    
    if (isTokenQuotaError) {
      const alertMsg = `⚠️ <b>YAPAY ZEKA LİMİT/TOKEN HATASI</b>\n\n` +
        `<b>Servis Sağlayıcı:</b> ${provider}\n` +
        `<b>Detay:</b> <code>${error.message}</code>\n\n` +
        `⚙️ Sistem geçici olarak simülasyon moduna dönmüştür. Lütfen API anahtarlarınızı veya kotalarınızı kontrol edin.`;
      
      this.sendTelegramNotification(alertMsg).catch(err => {
        this.logger.error('Failed to send Telegram alert for AI error:', err);
      });
    }
  }

  async getAiSettings() {
    let settings = await this.prisma.aiModelSetting.findUnique({
      where: { id: 'GLOBAL' },
    });
    if (!settings) {
      settings = await this.prisma.aiModelSetting.create({
        data: { id: 'GLOBAL' },
      });
    }
    return settings;
  }

  async saveAiSettings(data: any) {
    return this.prisma.aiModelSetting.upsert({
      where: { id: 'GLOBAL' },
      update: {
        geminiKey: data.geminiKey,
        geminiUrl: data.geminiUrl,
        openAiKey: data.openAiKey,
        openAiUrl: data.openAiUrl,
        claudeKey: data.claudeKey,
        claudeUrl: data.claudeUrl,
        stabilityKey: data.stabilityKey,
        huggingFaceKey: data.huggingFaceKey,
        defaultTextProvider: data.defaultTextProvider,
        defaultTextModel: data.defaultTextModel,
        defaultImageProvider: data.defaultImageProvider,
        defaultImageModel: data.defaultImageModel,
        customModels: data.customModels || [],
      },
      create: {
        id: 'GLOBAL',
        geminiKey: data.geminiKey,
        geminiUrl: data.geminiUrl,
        openAiKey: data.openAiKey,
        openAiUrl: data.openAiUrl,
        claudeKey: data.claudeKey,
        claudeUrl: data.claudeUrl,
        stabilityKey: data.stabilityKey,
        huggingFaceKey: data.huggingFaceKey,
        defaultTextProvider: data.defaultTextProvider || 'gemini',
        defaultTextModel: data.defaultTextModel || 'gemini-2.5-flash',
        defaultImageProvider: data.defaultImageProvider || 'huggingface',
        defaultImageModel: data.defaultImageModel || 'flux',
        customModels: data.customModels || [],
      },
    });
  }

  async fetchModels(apiUrl: string, apiKey: string, provider: string) {
    try {
      if (!apiUrl || !apiKey) {
        throw new Error('API adresi ve anahtarı gereklidir.');
      }
      
      const cleanUrl = apiUrl.replace(/\/$/, '');
      
      if (provider === 'gemini') {
        const response = await fetch(`${cleanUrl}/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
          throw new Error(`Google Gemini API hatası: ${response.statusText}`);
        }
        const data = await response.json();
        if (data && Array.isArray(data.models)) {
          return data.models.map((m: any) => m.name.replace('models/', ''));
        }
        return [];
      } else {
        const headers: any = {};
        if (provider === 'claude') {
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await fetch(`${cleanUrl}/v1/models`, {
          headers,
        });
        
        if (!response.ok) {
          throw new Error(`API bağlantı hatası: ${response.statusText} (${response.status})`);
        }
        
        const data = await response.json();
        if (data && Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id);
        } else if (data && Array.isArray(data)) {
          return data.map((m: any) => m.id || m.name || m);
        }
        return [];
      }
    } catch (error) {
      throw new Error(`Modeller alınamadı: ${error.message}`);
    }
  }
}

