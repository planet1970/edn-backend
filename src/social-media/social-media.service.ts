import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SocialMediaService {
  private readonly logger = new Logger(SocialMediaService.name);

  constructor(private prisma: PrismaService) {}

  // 1. Generate post content using specified AI APIs (or simulated)
  async generatePost(
    prompt: string,
    platform: string,
    tone: string,
    textProvider: string = 'gemini',
    imageProvider: string = 'simulation',
    videoProvider: string = 'simulation',
    includeImage: boolean = false,
    includeVideo: boolean = false,
  ) {
    const logs: string[] = [];
    let caption = '';
    let imagePrompt = '';
    let videoPrompt = '';
    let imageUrl = '';
    let videoUrl = '';
    let textProviderUsed = textProvider;
    let imageProviderUsed = imageProvider;
    let videoProviderUsed = videoProvider;

    // System instruction for Text AIs
    const systemInstruction = `Sen profesyonel bir sosyal medya içerik üreticisisin. 
Kullanıcının belirteceği konu veya prompt doğrultusunda, belirtilen platform ve ses tonuna uygun, dikkat çekici, emojilerle zenginleştirilmiş ve popüler hashtag'leri içeren bir paylaşım yazısı hazırla.
Ayrıca bu paylaşımla birlikte kullanılmak üzere bir yapay zeka görsel üreticisine (örn: Midjourney, DALL-E) verilebilecek detaylı İngilizce görsel üretim promptu (imagePrompt) hazırla.
Ayrıca bu paylaşımla birlikte kullanılmak üzere bir yapay zeka video üreticisine (örn: Sora, Runway) verilebilecek detaylı İngilizce video üretim promptu (videoPrompt) hazırla.
Çıktıyı kesinlikle geçerli bir JSON formatında ver. JSON formatı şu şekilde olmalıdır:
{
  "caption": "Sosyal medya gönderi metni...",
  "imagePrompt": "İngilizce görsel üretim promptu...",
  "videoPrompt": "İngilizce video üretim promptu..."
}`;

    // --- 1. Text Generation ---
    if (textProvider === 'openai') {
      const openAiKey = process.env.OPENAI_API_KEY;
      if (!openAiKey) {
        logs.push('OPENAI_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
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
            logs.push('Metin OpenAI GPT ile başarıyla üretildi.');
          }
        } catch (error) {
          logs.push(`OpenAI metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          textProviderUsed = 'simulation';
        }
      }
    } else if (textProvider === 'claude') {
      const claudeKey = process.env.CLAUDE_API_KEY;
      if (!claudeKey) {
        logs.push('CLAUDE_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
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
            logs.push('Metin Anthropic Claude ile başarıyla üretildi.');
          }
        } catch (error) {
          logs.push(`Claude metin üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
          textProviderUsed = 'simulation';
        }
      }
    } else if (textProvider === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        logs.push('GEMINI_API_KEY bulunamadı. Metin üretimi için simülasyon moduna geçiliyor.');
        textProviderUsed = 'simulation';
      } else {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
            logs.push('Metin Google Gemini ile başarıyla üretildi.');
          }
        } catch (error) {
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
      if (imageProvider === 'dalle') {
        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
          logs.push('OPENAI_API_KEY bulunamadı. DALL-E görsel üretimi için simülasyon moduna geçiliyor.');
          imageProviderUsed = 'simulation';
        } else {
          try {
            const response = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
              },
              body: JSON.stringify({
                model: 'dall-e-3',
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
            logs.push('Görsel OpenAI DALL-E 3 ile başarıyla üretildi.');
          } catch (error) {
            logs.push(`DALL-E görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
            imageProviderUsed = 'simulation';
          }
        }
      } else if (imageProvider === 'stability') {
        const stabilityKey = process.env.STABILITY_API_KEY;
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
            logs.push(`Stability AI görsel üretim hatası: ${error.message}. Simülasyona geçiliyor.`);
            imageProviderUsed = 'simulation';
          }
        }
      } else if (imageProvider === 'huggingface') {
        const hfKey = process.env.HUGGINGFACE_API_KEY;
        if (!hfKey) {
          logs.push('HUGGINGFACE_API_KEY bulunamadı. Hugging Face görsel üretimi için simülasyon moduna geçiliyor.');
          imageProviderUsed = 'simulation';
        } else {
          try {
            const response = await fetch(
              'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
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
        const openAiKey = process.env.OPENAI_API_KEY;
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

  private getSimulatedResponse(prompt: string, platform: string, tone: string) {
    const formattedPrompt = prompt ? `"${prompt}"` : 'Edirne turizmi';
    return {
      caption: `🌟 [Simülasyon Modu] ${formattedPrompt} hakkında harika bir ${platform} paylaşımı! (${tone} tonunda)\n\nEdirne'nin zengin tarihi ve eşsiz kültürel mirasları her köşede sizi bekliyor. Selimiye Camii'nden Meriç Köprüsü'ne kadar uzanan bu eşsiz serüveni keşfetmeye hazır mısınız? 🕌🌉✨\n\nSiz en çok hangi tarihi noktayı merak ediyorsunuz? Yorumlarda buluşalım! 👇\n\n#EdirneGezisi #TarihiŞehirEdirne #EdirneKültürü #Gezginler #SeyahatNotları #Simülasyon`,
      imagePrompt: `A beautiful cinematic shot of historical ${prompt} in Edirne, Turkey, golden hour lighting, hyper-detailed, 8k resolution, professional travel photography style.`,
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
    return this.prisma.socialMediaPost.create({
      data: {
        platform: data.platform,
        prompt: data.prompt || '',
        caption: data.caption,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        postType: data.postType || 'POST',
        status: data.status || 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
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

    try {
      // Find account for this platform
      const account = await this.prisma.socialMediaAccount.findFirst({
        where: { platform: post.platform, isActive: true },
      });

      if (!account) {
        throw new Error(`${post.platform} için aktif bir sosyal medya hesabı bulunamadı.`);
      }

      if (account.isSimulated) {
        // Simulated Publish
        this.logger.log(`[SIMULATED] Posting to ${post.platform} for account ${account.username}`);
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network latency
        
        return this.prisma.socialMediaPost.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            errorMessage: null,
          },
        });
      } else {
        // Real API integrations
        this.logger.log(`[REAL] Attempting to publish to ${post.platform} API...`);
        const credentials: any = account.credentials;
        const accessToken = credentials?.accessToken?.trim();
        const pageId = credentials?.pageId?.trim();

        if (!accessToken) {
          throw new Error('Access Token eksik. Gerçek gönderi paylaşılamadı.');
        }

        if (post.platform === 'FACEBOOK') {
          if (!pageId) {
            throw new Error('Sayfa Kimliği (Page ID) eksik. Facebook paylaşımı yapılamadı.');
          }

          const isLocalMedia = (url?: string) => url && (url.startsWith('/') || url.includes('localhost'));
          if (isLocalMedia(post.imageUrl) || isLocalMedia(post.videoUrl)) {
            throw new Error(
              'Görsel veya video yerel sunucuda (localhost) veya veri formatında barındırılıyor. ' +
              'Meta API\'lerinin dosyayı indirebilmesi için internete açık, genel bir URL (örn. ngrok tüneli veya sunucu URL\'si) gereklidir.'
            );
          }

          let fbUrl = `https://graph.facebook.com/v18.0/${pageId}/feed`;
          let body: any = {
            message: post.caption,
            access_token: accessToken,
          };

          const isPublicMedia = (url?: string) => url && url.startsWith('http') && !url.includes('localhost');

          if (isPublicMedia(post.imageUrl)) {
            fbUrl = `https://graph.facebook.com/v18.0/${pageId}/photos`;
            body = {
              url: post.imageUrl,
              message: post.caption,
              access_token: accessToken,
            };
          } else if (isPublicMedia(post.videoUrl)) {
            fbUrl = `https://graph.facebook.com/v18.0/${pageId}/videos`;
            body = {
              file_url: post.videoUrl,
              description: post.caption,
              access_token: accessToken,
            };
          }

          const fbResponse = await fetch(fbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const fbData = await fbResponse.json();
          if (!fbResponse.ok) {
            throw new Error(`Facebook API Hatası: ${fbData?.error?.message || fbResponse.statusText}`);
          }

          return this.prisma.socialMediaPost.update({
            where: { id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
            },
          });
        }

        if (post.platform === 'INSTAGRAM') {
          let instagramBusinessAccountId = credentials?.instagramBusinessAccountId;
          
          if (!instagramBusinessAccountId && pageId) {
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

          const isLocalMedia = (url?: string) => url && (url.startsWith('/') || url.includes('localhost'));
          if (isLocalMedia(post.imageUrl) || isLocalMedia(post.videoUrl)) {
            throw new Error(
              'Görsel veya video yerel sunucuda (localhost) veya veri formatında barındırılıyor. ' +
              'Instagram API\'sinin medyayı indirebilmesi için genel, internete açık bir URL gereklidir.'
            );
          }

          // Helper to publish to Instagram
          const publishToInstagram = async (type: 'POST' | 'STORY') => {
            const mediaContainerUrl = `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media`;
            const containerBody: any = {
              access_token: accessToken,
            };

            if (type === 'STORY') {
              containerBody.media_type = 'STORIES';
              if (post.videoUrl) {
                containerBody.video_url = post.videoUrl;
              } else if (post.imageUrl) {
                containerBody.image_url = post.imageUrl;
              } else {
                throw new Error('Hikaye paylaşımı için bir görsel veya video gereklidir.');
              }
            } else {
              // Feed Post
              if (post.videoUrl) {
                containerBody.media_type = 'REELS';
                containerBody.video_url = post.videoUrl;
                containerBody.caption = post.caption;
              } else if (post.imageUrl) {
                containerBody.image_url = post.imageUrl;
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

            // Wait for video processing
            if (post.videoUrl) {
              let status = 'IN_PROGRESS';
              let attempts = 0;
              const maxAttempts = 12; // 60 seconds max
              while (status !== 'FINISHED' && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                const checkRes = await fetch(
                  `https://graph.facebook.com/v18.0/${creationId}?fields=status_code,status_message&access_token=${accessToken}`
                );
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  status = checkData.status_code || 'IN_PROGRESS';
                  if (status === 'ERROR') {
                    throw new Error(`Instagram video işleme hatası: ${checkData.status_message || 'Bilinmeyen hata'}`);
                  }
                }
                attempts++;
              }
              if (status !== 'FINISHED') {
                throw new Error('Instagram video işleme zaman aşımına uğradı. Lütfen tekrar deneyin.');
              }
            }

            // Publish
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

          return this.prisma.socialMediaPost.update({
            where: { id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
            },
          });
        }

        // TikTok or others
        throw new Error(`${post.platform} için gerçek paylaşım entegrasyonu henüz aktif değil.`);
      }
    } catch (error) {
      this.logger.error(`Gönderi paylaşımında hata (${post.platform}):`, error);
      return this.prisma.socialMediaPost.update({
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
}
