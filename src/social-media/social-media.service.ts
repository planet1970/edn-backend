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

  private telegramOffsets = new Map<number, number>();
  private isPollingTelegram = false;

  async onModuleInit() {
    // Initialize telegramOffsets to latest to avoid reprocessing old updates on server start
    try {
      const settings = await this.prisma.telegramSetting.findMany({
        where: { isActive: true }
      });
      for (const setting of settings) {
        if (setting.botToken) {
          const url = `https://api.telegram.org/bot${setting.botToken}/getUpdates?limit=1&offset=-1`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.result.length > 0) {
              const offset = data.result[0].update_id + 1;
              this.telegramOffsets.set(setting.id, offset);
              this.logger.log(`Telegram polling initialized for setting #${setting.id} (${setting.name}). Offset: ${offset}`);
            }
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
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 45000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const customOptions = { ...options };
      if (!customOptions.signal) {
        customOptions.signal = controller.signal;
      }
      const response = await fetch(url, customOptions);
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw new Error(`AI isteği zaman aşımına uğradı (${Math.round(timeoutMs / 1000)} sn).`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // 1. Generate post content using specified AI APIs (or simulated)
  private safeExtractAndParseJson(text: string): any {
    if (!text) return null;
    let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (clean.includes('```')) {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        clean = match[1].trim();
      }
    }
    try {
      return JSON.parse(clean);
    } catch {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
        } catch {
          const captionMatch = clean.match(/"caption"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
          const imagePromptMatch = clean.match(/"imagePrompt"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
          const videoPromptMatch = clean.match(/"videoPrompt"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
          if (captionMatch || imagePromptMatch) {
            return {
              caption: captionMatch ? captionMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '',
              imagePrompt: imagePromptMatch ? imagePromptMatch[1].replace(/\\"/g, '"') : '',
              videoPrompt: videoPromptMatch ? videoPromptMatch[1].replace(/\\"/g, '"') : '',
            };
          }
        }
      }
    }
    return null;
  }

  private async executeSingleTextProvider(
    provider: string,
    model: string,
    prompt: string,
    platform: string,
    tone: string,
    aiSettings: any,
    systemInstruction: string,
    logs: string[]
  ): Promise<{ caption: string; imagePrompt: string; videoPrompt: string; providerUsed: string }> {
    let customTextConfig: any = null;
    if (aiSettings.customModels && Array.isArray(aiSettings.customModels)) {
      customTextConfig = (aiSettings.customModels as any[]).find(
        (m: any) => String(m.id) === String(provider) || m.name === provider
      );
    }

    if (customTextConfig) {
      const customKey = customTextConfig.apiKey;
      const cleanUrl = (customTextConfig.apiUrl || '').replace(/\/$/, '');
      const modelName = customTextConfig.selectedModel || model;
      if (!customKey) {
        throw new Error(`Özel Sağlayıcı (${customTextConfig.name}) için API Anahtarı eksik.`);
      }
      const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/chat/completions` : `${cleanUrl}/v1/chat/completions`;
      logs.push(`Özel API (${customTextConfig.name}) ile metin üretiliyor... model: ${modelName}`);

      const isLocalhost = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');

      const callApi = async (useJsonMode: boolean) => {
        const body: any = {
          model: modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
          ],
          temperature: 0.7,
        };
        if (useJsonMode) {
          body.response_format = { type: 'json_object' };
        }
        try {
          return await this.fetchWithTimeout(fetchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${customKey}`,
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'EDN Sosyal Medya',
            },
            body: JSON.stringify(body),
          }, 30000);
        } catch (callErr: any) {
          if (isLocalhost) {
            throw new Error(`Özel API (${customTextConfig.name}): "${cleanUrl}" yerel adresine ulaşılamadı. Sunucu ortamında localhost API'leri doğrudan çalışmaz.`);
          }
          throw callErr;
        }
      };

      let response = await callApi(true);
      if (!response.ok) {
        const errText = await response.text();
        if (errText.includes('response_format') || errText.includes('json_object') || response.status === 400) {
          logs.push(`JSON formatı desteklenmedi, standart metin formatı deneniyor...`);
          response = await callApi(false);
          if (!response.ok) {
            const err2 = await response.text();
            throw new Error(`Özel API (${customTextConfig.name}) Hatası [${response.status}]: ${err2}`);
          }
        } else {
          throw new Error(`Özel API (${customTextConfig.name}) Hatası [${response.status}]: ${errText}`);
        }
      }

      const resData = await response.json();
      let rawText = resData.choices?.[0]?.message?.content || '';
      
      // Strip think tags (DeepSeek R1 etc.)
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      const parsed = this.safeExtractAndParseJson(rawText);
      if (parsed && parsed.caption) {
        return {
          caption: parsed.caption,
          imagePrompt: parsed.imagePrompt || prompt,
          videoPrompt: parsed.videoPrompt || prompt,
          providerUsed: customTextConfig.name,
        };
      }

      // Robust fallback extraction: if AI returned plain text or imperfect JSON
      if (rawText.length > 10) {
        let cleanedText = rawText
          .replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1')
          .replace(/^\{[\s\S]*"caption"\s*:\s*"([^"]+)"[\s\S]*\}$/, '$1')
          .trim();
        return {
          caption: cleanedText,
          imagePrompt: prompt,
          videoPrompt: prompt,
          providerUsed: customTextConfig.name,
        };
      }

      throw new Error(`Özel API (${customTextConfig.name}) geçerli içerik döndürmedi.`);
    }

    if (provider === 'gemini') {
      const geminiKey = aiSettings.geminiKey || process.env.GEMINI_API_KEY;
      const cleanUrl = (aiSettings.geminiUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      if (!geminiKey) {
        throw new Error('Google Gemini API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'gemini-2.5-flash';
      logs.push(`Google Gemini (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(
        `${cleanUrl}/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
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
        },
        35000
      );
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Google Gemini Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('Google Gemini geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'Google Gemini',
      };
    }

    if (provider === 'openai') {
      const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
      const cleanUrl = (aiSettings.openAiUrl || 'https://api.openai.com').replace(/\/$/, '');
      if (!openAiKey) {
        throw new Error('OpenAI API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'gpt-4o-mini';
      logs.push(`OpenAI (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(`${cleanUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`,
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
      }, 35000);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.choices?.[0]?.message?.content;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('OpenAI geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'OpenAI',
      };
    }

    if (provider === 'claude') {
      const claudeKey = aiSettings.claudeKey || process.env.CLAUDE_API_KEY;
      const cleanUrl = (aiSettings.claudeUrl || 'https://api.anthropic.com').replace(/\/$/, '');
      if (!claudeKey) {
        throw new Error('Claude API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'claude-3-5-sonnet-20241022';
      logs.push(`Anthropic Claude (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(`${cleanUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 1500,
          system: systemInstruction,
          messages: [
            { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
          ]
        })
      }, 35000);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.content?.[0]?.text;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('Anthropic Claude geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'Anthropic Claude',
      };
    }

    if (provider === 'nvidia') {
      const nvidiaKey = aiSettings.nvidiaKey;
      const cleanUrl = (aiSettings.nvidiaUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
      if (!nvidiaKey) {
        throw new Error('NVIDIA NIM API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'meta/llama-3.3-70b-instruct';
      const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/chat/completions` : `${cleanUrl}/v1/chat/completions`;
      logs.push(`NVIDIA NIM (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
          ],
          temperature: 0.7,
        })
      }, 35000);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`NVIDIA NIM Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.choices?.[0]?.message?.content;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('NVIDIA NIM geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'NVIDIA NIM',
      };
    }

    if (provider === 'groq') {
      const groqKey = aiSettings.groqKey || process.env.GROQ_API_KEY;
      const cleanUrl = (aiSettings.groqUrl || 'https://api.groq.com').replace(/\/$/, '');
      if (!groqKey) {
        throw new Error('Groq API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'llama-3.3-70b-versatile';
      const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/chat/completions` : `${cleanUrl}/v1/chat/completions`;
      logs.push(`Groq (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
          ],
          temperature: 0.7,
        })
      }, 35000);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.choices?.[0]?.message?.content;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('Groq geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'Groq',
      };
    }

    if (provider === 'grok') {
      const grokKey = aiSettings.grokKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      const cleanUrl = (aiSettings.grokUrl || 'https://api.x.ai').replace(/\/$/, '');
      if (!grokKey) {
        throw new Error('xAI Grok API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'grok-2-latest';
      const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/chat/completions` : `${cleanUrl}/v1/chat/completions`;
      logs.push(`xAI Grok (${modelName}) ile metin üretiliyor...`);
      const response = await this.fetchWithTimeout(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Konu/Prompt: "${prompt}"\nPlatform: ${platform}\nSes Tonu: ${tone}\n\nİçeriği oluştur:` }
          ],
          temperature: 0.7,
        })
      }, 35000);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`xAI Grok Hatası [${response.status}]: ${err}`);
      }
      const resData = await response.json();
      const rawText = resData.choices?.[0]?.message?.content;
      const parsed = this.safeExtractAndParseJson(rawText);
      if (!parsed || !parsed.caption) {
        throw new Error('xAI Grok geçerli JSON içeriği döndürmedi.');
      }
      return {
        caption: parsed.caption,
        imagePrompt: parsed.imagePrompt || '',
        videoPrompt: parsed.videoPrompt || '',
        providerUsed: 'xAI Grok',
      };
    }

    throw new Error(`Bilinmeyen veya desteklenmeyen metin sağlayıcısı: "${provider}"`);
  }

  private async executeSingleImageProvider(
    provider: string,
    model: string,
    imagePrompt: string,
    prompt: string,
    caption: string,
    aiSettings: any,
    logs: string[]
  ): Promise<{ imageUrl: string; providerUsed: string }> {
    let customImageConfig: any = null;
    if (aiSettings.customModels && Array.isArray(aiSettings.customModels)) {
      customImageConfig = (aiSettings.customModels as any[]).find(
        (m: any) => String(m.id) === String(provider) || m.name === provider
      );
    }

    if (customImageConfig) {
      const customKey = customImageConfig.apiKey;
      const cleanUrl = (customImageConfig.apiUrl || '').replace(/\/$/, '');
      const modelName = customImageConfig.selectedModel || model;
      if (!customKey) {
        throw new Error(`Özel Görsel Sağlayıcı (${customImageConfig.name}) için API Anahtarı eksik.`);
      }
      const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/images/generations` : `${cleanUrl}/v1/images/generations`;
      logs.push(`Özel API (${customImageConfig.name}) ile görsel üretiliyor... model: ${modelName}`);
      const response = await this.fetchWithTimeout(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'EDN Sosyal Medya',
        },
        body: JSON.stringify({
          model: modelName,
          prompt: imagePrompt || prompt,
          n: 1,
          size: '1024x1024'
        })
      }, 45000);
      if (!response.ok) {
        const errText = await response.text();
        let parsedMsg = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedMsg = parsed?.error?.message || errText;
        } catch (_) {}
        if (response.status === 404) {
          throw new Error(`Özel model (${modelName}) görsel API'sinde bulunamadı (404). Seçilen model bir metin (LLM) modeli olabilir. Görsel üretimi için Hugging Face (stabilityai/stable-diffusion-2-1), Fal.ai veya DALL-E gibi bir görsel modeli seçilmelidir.`);
        }
        throw new Error(`Özel model görsel API hatası [${response.status}]: ${parsedMsg}`);
      }
      const data = await response.json();
      let img = data.data?.[0]?.url || data.data?.[0]?.b64_json || '';
      if (img && !img.startsWith('data:') && !img.startsWith('http')) {
        img = `data:image/png;base64,${img}`;
      }
      if (!img) throw new Error('Özel model görsel verisi döndürmedi.');
      return { imageUrl: img, providerUsed: customImageConfig.name };
    }

    if (provider === 'pollinations') {
      let modelName = model || 'flux';
      if (modelName === 'turbo') modelName = 'flux';
      const cleanPrompt = (imagePrompt || prompt || 'Edirne historical city photo').trim();
      const seed = Math.floor(Math.random() * 10000000);
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${encodeURIComponent(modelName)}&width=1024&height=1024&nologo=true&seed=${seed}`;

      logs.push(`Pollinations AI (${modelName}) ile görsel üretiliyor...`);
      let response = await this.fetchWithTimeout(pollinationsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg,image/png,image/*,*/*',
        }
      }, 55000);

      if (!response.ok && (response.status === 429 || response.status === 500)) {
        logs.push('Pollinations sunucusu meşgul, 3 saniye sonra FLUX ile yeniden deneniyor...');
        await new Promise(r => setTimeout(r, 3000));
        const retrySeed = Math.floor(Math.random() * 10000000);
        const retryUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux-realism&width=1024&height=1024&nologo=true&seed=${retrySeed}`;
        try {
          response = await this.fetchWithTimeout(retryUrl, {
            method: 'GET',
            headers: { 'Accept': 'image/jpeg,image/png,image/*,*/*' }
          }, 55000);
        } catch (_) {}
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pollinations AI Hatası [${response.status}]: ${errText.substring(0, 150)}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength < 200) {
        throw new Error('Pollinations AI geçerli görsel verisi döndürmedi.');
      }
      const base64 = Buffer.from(buffer).toString('base64');
      const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
      return { imageUrl: `data:${mime};base64,${base64}`, providerUsed: `Pollinations AI (${modelName})` };
    }

    if (provider === 'huggingface') {
      const hfKey = aiSettings.huggingFaceKey || process.env.HUGGINGFACE_API_KEY;
      if (!hfKey) {
        throw new Error('Hugging Face API Anahtarı eksik veya tanımlanmamış.');
      }
      const finalPrompt = imagePrompt || prompt;
      const uniquePrompt = `${finalPrompt.trim()} [Variation: ${Math.random().toString(36).substring(7)}]`;
      const modelPath = model || 'stabilityai/stable-diffusion-2-1';
      logs.push(`Hugging Face (${modelPath}) ile görsel üretiliyor...`);
      const img = await this.generateHuggingFaceImage(modelPath, uniquePrompt, hfKey, logs);
      return { imageUrl: img, providerUsed: `Hugging Face (${modelPath})` };
    }

    if (provider === 'fal') {
      const falKey = aiSettings.falKey || process.env.FAL_KEY || process.env.FAL_API_KEY;
      const falUrl = (aiSettings.falUrl || 'https://fal.run').replace(/\/$/, '');
      if (!falKey) {
        throw new Error('Fal.ai API Anahtarı eksik veya tanımlanmamış.');
      }
      let modelName = model || 'fal-ai/flux/schnell';
      if (modelName === 'flux' || modelName === 'flux-schnell') modelName = 'fal-ai/flux/schnell';
      else if (modelName === 'flux-dev') modelName = 'fal-ai/flux/dev';
      else if (modelName === 'flux-pro') modelName = 'fal-ai/flux/pro';

      logs.push(`Fal.ai (${modelName}) ile görsel üretiliyor...`);
      const response = await this.fetchWithTimeout(`${falUrl}/${modelName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`
        },
        body: JSON.stringify({
          prompt: imagePrompt || prompt,
          image_size: 'square_hd'
        })
      }, 45000);
      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 403 && errText.includes('TOP_UP')) {
          throw new Error('Fal.ai Bakiye Yetersiz: Hesabınız kilitli veya krediniz bitmiş (Top-Up gerekli).');
        }
        throw new Error(`Fal.ai Hatası [${response.status}]: ${errText}`);
      }
      const data = await response.json();
      let img = data.images?.[0]?.url || '';
      if (img && !img.startsWith('data:') && !img.startsWith('http')) {
        img = `data:image/png;base64,${img}`;
      }
      if (!img) throw new Error('Fal.ai görsel verisi döndürmedi.');
      return { imageUrl: img, providerUsed: `Fal.ai (${modelName})` };
    }

    if (provider === 'dalle') {
      const openAiKey = aiSettings.openAiKey || process.env.OPENAI_API_KEY;
      const openAiUrl = (aiSettings.openAiUrl || 'https://api.openai.com').replace(/\/$/, '');
      if (!openAiKey) {
        throw new Error('OpenAI API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'dall-e-3';
      logs.push(`OpenAI DALL-E (${modelName}) ile görsel üretiliyor...`);
      const response = await this.fetchWithTimeout(`${openAiUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          prompt: imagePrompt || prompt,
          n: 1,
          size: '1024x1024'
        })
      }, 45000);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DALL-E Hatası [${response.status}]: ${errText}`);
      }
      const data = await response.json();
      const img = data.data?.[0]?.url || '';
      if (!img) throw new Error('DALL-E görsel verisi döndürmedi.');
      return { imageUrl: img, providerUsed: `OpenAI DALL-E (${modelName})` };
    }

    if (provider === 'gemini') {
      const geminiKey = aiSettings.geminiKey || process.env.GEMINI_API_KEY;
      const geminiUrl = (aiSettings.geminiUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      if (!geminiKey) {
        throw new Error('Google Gemini API Anahtarı eksik veya tanımlanmamış.');
      }
      let modelName = model || 'imagen-3.0-generate-002';
      logs.push(`Google Gemini (${modelName}) ile görsel üretiliyor...`);
      const response = await this.fetchWithTimeout(
        `${geminiUrl}/v1beta/models/${modelName}:predict?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt || prompt }],
            parameters: { sampleCount: 1, aspectRatio: '1:1' }
          })
        },
        45000
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Imagen Hatası [${response.status}]: ${errText}`);
      }
      const data = await response.json();
      const base64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (base64) {
        return { imageUrl: `data:image/png;base64,${base64}`, providerUsed: `Gemini Imagen (${modelName})` };
      }
      throw new Error('Gemini Imagen görsel verisi döndürmedi.');
    }

    if (provider === 'stability') {
      const stabilityKey = aiSettings.stabilityKey || process.env.STABILITY_API_KEY;
      if (!stabilityKey) {
        throw new Error('Stability AI API Anahtarı eksik veya tanımlanmamış.');
      }
      logs.push('Stability AI ile görsel üretiliyor...');
      const response = await this.fetchWithTimeout(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${stabilityKey}`
          },
          body: JSON.stringify({
            text_prompts: [{ text: imagePrompt || prompt }],
            cfg_scale: 7,
            height: 1024,
            width: 1024,
            samples: 1,
            steps: 30
          })
        },
        45000
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stability AI Hatası [${response.status}]: ${errText}`);
      }
      const data = await response.json();
      const base64 = data.artifacts?.[0]?.base64;
      if (base64) {
        return { imageUrl: `data:image/png;base64,${base64}`, providerUsed: 'Stability AI' };
      }
      throw new Error('Stability AI görsel verisi döndürmedi.');
    }

    if (provider === 'grok') {
      const grokKey = aiSettings.grokKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      const grokUrl = (aiSettings.grokUrl || 'https://api.x.ai').replace(/\/$/, '');
      if (!grokKey) {
        throw new Error('xAI Grok API Anahtarı eksik veya tanımlanmamış.');
      }
      const modelName = model || 'grok-imagine-image-quality';
      logs.push(`xAI Grok (${modelName}) ile görsel üretiliyor...`);
      const response = await this.fetchWithTimeout(`${grokUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey}`
        },
        body: JSON.stringify({
          model: modelName,
          prompt: imagePrompt || prompt,
          n: 1,
          size: '1024x1024'
        })
      }, 45000);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Grok Hatası [${response.status}]: ${errText}`);
      }
      const data = await response.json();
      let img = data.data?.[0]?.url || data.data?.[0]?.b64_json || '';
      if (img && !img.startsWith('data:') && !img.startsWith('http')) {
        img = `data:image/png;base64,${img}`;
      }
      if (!img) throw new Error('Grok görsel verisi döndürmedi.');
      return { imageUrl: img, providerUsed: `xAI Grok (${modelName})` };
    }

    throw new Error(`Bilinmeyen veya desteklenmeyen görsel sağlayıcısı: "${provider}"`);
  }

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
    const logs: string[] = [];

    let caption = '';
    let imagePrompt = '';
    let videoPrompt = '';
    let imageUrl = '';
    let videoUrl = '';
    let textProviderUsed = '';
    let imageProviderUsed = '';
    let videoProviderUsed = videoProvider;
    let textGenerationError = '';
    let imageGenerationError = '';

    const primaryTextProvider = textProvider || aiSettings.defaultTextProvider || 'gemini';
    const primaryTextModel = textModel || aiSettings.defaultTextModel || 'gemini-2.5-flash';
    const fallbackTextProvider = aiSettings.fallbackTextProvider;
    const fallbackTextModel = aiSettings.fallbackTextModel;

    const primaryImageProvider = imageProvider || aiSettings.defaultImageProvider || 'huggingface';
    const primaryImageModel = imageModel || aiSettings.defaultImageModel || 'stabilityai/stable-diffusion-2-1';
    const fallbackImageProvider = aiSettings.fallbackImageProvider;
    const fallbackImageModel = aiSettings.fallbackImageModel;

    const systemInstruction = `You are a social media post generator.
You must output a JSON object containing:
{
  "caption": "The post caption in the user's requested language. Use the user's prompt exactly as the instruction to generate this text, formatted for the platform (${platform}) and tone (${tone}). Do not append any call-to-action like 'comments down below'.",
  "imagePrompt": "A detailed English description of an image that fits the generated caption.",
  "videoPrompt": "A detailed English description of a video that fits the generated caption."
}

Do not add any other stylistic rules, presets, or constraints. Return ONLY a valid JSON object.`;

    // 1. Text Generation with Fallback
    try {
      const res = await this.executeSingleTextProvider(
        primaryTextProvider,
        primaryTextModel,
        prompt,
        platform,
        tone,
        aiSettings,
        systemInstruction,
        logs
      );
      caption = res.caption;
      imagePrompt = res.imagePrompt;
      videoPrompt = res.videoPrompt;
      textProviderUsed = res.providerUsed;
      logs.push(`Metin ana model (${textProviderUsed}) ile başarıyla üretildi.`);
    } catch (err1: any) {
      this.logger.warn(`Ana metin modeli (${primaryTextProvider}) başarısız oldu: ${err1.message}`);
      logs.push(`Ana metin modeli (${primaryTextProvider}) hatası: ${err1.message}`);
      this.checkAiTokenError(err1, `Metin Modeli (${primaryTextProvider})`);

      let fallbackSuccess = false;
      const canRunFallback = fallbackTextProvider && (
        fallbackTextProvider !== primaryTextProvider ||
        (fallbackTextModel && fallbackTextModel !== primaryTextModel)
      );

      if (canRunFallback) {
        try {
          logs.push(`Yedek metin modeline (${fallbackTextProvider} - ${fallbackTextModel || 'varsayılan'}) geçiliyor...`);
          const res = await this.executeSingleTextProvider(
            fallbackTextProvider,
            fallbackTextModel,
            prompt,
            platform,
            tone,
            aiSettings,
            systemInstruction,
            logs
          );
          caption = res.caption;
          imagePrompt = res.imagePrompt;
          videoPrompt = res.videoPrompt;
          textProviderUsed = `${res.providerUsed} (Yedek Model)`;
          logs.push(`Metin yedek model (${textProviderUsed}) ile başarıyla üretildi.`);
          fallbackSuccess = true;
        } catch (err2: any) {
          this.logger.warn(`Yedek metin modeli (${fallbackTextProvider}) da başarısız oldu: ${err2.message}`);
          logs.push(`Yedek metin modeli (${fallbackTextProvider}) hatası: ${err2.message}`);
          textGenerationError = `Ana Model (${primaryTextProvider}): ${err1.message} | Yedek Model (${fallbackTextProvider}): ${err2.message}`;
        }
      }

      if (!fallbackSuccess && primaryTextProvider !== 'gemini' && fallbackTextProvider !== 'gemini' && (aiSettings.geminiKey || process.env.GEMINI_API_KEY)) {
        // Auto rescue with Gemini if custom/fallback models failed
        try {
          logs.push('Kurtarma modeli olarak Google Gemini deneniyor...');
          const res = await this.executeSingleTextProvider(
            'gemini',
            'gemini-2.5-flash',
            prompt,
            platform,
            tone,
            aiSettings,
            systemInstruction,
            logs
          );
          caption = res.caption;
          imagePrompt = res.imagePrompt;
          videoPrompt = res.videoPrompt;
          textProviderUsed = 'Google Gemini (Kurtarma)';
          logs.push(`Metin kurtarma modeli (${textProviderUsed}) ile başarıyla üretildi.`);
          fallbackSuccess = true;
        } catch (err3: any) {
          textGenerationError = `${textGenerationError ? textGenerationError + ' | ' : ''}Kurtarma Modeli (Gemini): ${err3.message}`;
        }
      } else if (!fallbackSuccess && !textGenerationError) {
        textGenerationError = `Ana Model (${primaryTextProvider}): ${err1.message}`;
      }

      if (!fallbackSuccess) {
        const sim = this.getSimulatedResponse(prompt, platform, tone);
        caption = sim.caption;
        imagePrompt = sim.imagePrompt;
        videoPrompt = `A beautiful high-quality cinematic video showing historical ${prompt} in Edirne, Turkey.`;
        textProviderUsed = 'simulation';
        logs.push('Tüm metin modelleri başarısız oldu. Simülasyon moduna geçildi.');
      }
    }

    // Ensure valid imagePrompt
    if (includeImage && (!imagePrompt || imagePrompt.trim() === '')) {
      imagePrompt = `A high quality photo representing: ${caption.substring(0, 100) || prompt}`;
    }

    // 2. Image Generation with Fallback
    if (includeImage) {
      try {
        const res = await this.executeSingleImageProvider(
          primaryImageProvider,
          primaryImageModel,
          imagePrompt,
          prompt,
          caption,
          aiSettings,
          logs
        );
        imageUrl = res.imageUrl;
        imageProviderUsed = res.providerUsed;
        logs.push(`Görsel ana model (${imageProviderUsed}) ile başarıyla üretildi.`);
      } catch (err1: any) {
        this.logger.warn(`Ana görsel modeli (${primaryImageProvider}) başarısız oldu: ${err1.message}`);
        logs.push(`Ana görsel modeli (${primaryImageProvider}) hatası: ${err1.message}`);
        this.checkAiTokenError(err1, `Görsel Modeli (${primaryImageProvider})`);

        let fallbackSuccess = false;
        const canRunImageFallback = fallbackImageProvider && (
          fallbackImageProvider !== primaryImageProvider ||
          (fallbackImageModel && fallbackImageModel !== primaryImageModel)
        );

        if (canRunImageFallback) {
          try {
            logs.push(`Yedek görsel modeline (${fallbackImageProvider} - ${fallbackImageModel || 'varsayılan'}) geçiliyor...`);
            const res = await this.executeSingleImageProvider(
              fallbackImageProvider,
              fallbackImageModel,
              imagePrompt,
              prompt,
              caption,
              aiSettings,
              logs
            );
            imageUrl = res.imageUrl;
            imageProviderUsed = `${res.providerUsed} (Yedek Model)`;
            logs.push(`Görsel yedek model (${imageProviderUsed}) ile başarıyla üretildi.`);
            fallbackSuccess = true;
          } catch (err2: any) {
            this.logger.warn(`Yedek görsel modeli (${fallbackImageProvider}) da başarısız oldu: ${err2.message}`);
            logs.push(`Yedek görsel modeli (${fallbackImageProvider}) hatası: ${err2.message}`);
            imageGenerationError = `Ana Görsel (${primaryImageProvider}): ${err1.message} | Yedek Görsel (${fallbackImageProvider}): ${err2.message}`;
          }
        }

        if (!fallbackSuccess && primaryImageProvider !== 'pollinations' && fallbackImageProvider !== 'pollinations') {
          // Auto rescue with free Pollinations AI (FLUX)
          try {
            logs.push('Kurtarma modeli olarak ücretsiz Pollinations AI (FLUX) deneniyor...');
            const res = await this.executeSingleImageProvider(
              'pollinations',
              'flux',
              imagePrompt,
              prompt,
              caption,
              aiSettings,
              logs
            );
            imageUrl = res.imageUrl;
            imageProviderUsed = 'Pollinations AI (Otomatik Kurtarma)';
            logs.push(`Görsel kurtarma modeli (${imageProviderUsed}) ile başarıyla üretildi.`);
            fallbackSuccess = true;
          } catch (errRescue: any) {
            this.logger.warn(`Pollinations kurtarma modeli de başarısız oldu: ${errRescue.message}`);
          }
        }

        if (!fallbackSuccess && primaryImageProvider !== 'huggingface' && fallbackImageProvider !== 'huggingface' && (aiSettings.huggingFaceKey || process.env.HUGGINGFACE_API_KEY)) {
          // Auto rescue with Hugging Face
          try {
            logs.push('Kurtarma görsel modeli olarak Hugging Face deneniyor...');
            const res = await this.executeSingleImageProvider(
              'huggingface',
              'black-forest-labs/FLUX.1-schnell',
              imagePrompt,
              prompt,
              caption,
              aiSettings,
              logs
            );
            imageUrl = res.imageUrl;
            imageProviderUsed = 'Hugging Face (Kurtarma)';
            logs.push(`Görsel kurtarma modeli (${imageProviderUsed}) ile başarıyla üretildi.`);
            fallbackSuccess = true;
          } catch (err3: any) {
            imageGenerationError = `${imageGenerationError ? imageGenerationError + ' | ' : ''}Kurtarma Görsel Modeli: ${err3.message}`;
          }
        } else if (!fallbackSuccess && !imageGenerationError) {
          imageGenerationError = `Ana Görsel (${primaryImageProvider}): ${err1.message}`;
        }

        if (!fallbackSuccess) {
          imageUrl = `https://picsum.photos/800/800?random=${Date.now()}`;
          imageProviderUsed = 'simulation';
          logs.push('Tüm görsel modelleri başarısız oldu. Stok görsel atandı.');
        }
      }
    }

    // 3. Video Generation
    if (includeVideo) {
      videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-historical-building-under-a-clear-blue-sky-42861-large.mp4';
      videoProviderUsed = 'simulation';
      logs.push('Video üretimi simüle edildi.');
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
      textGenerationError,
      imageGenerationError,
      isSimulated: textProviderUsed === 'simulation' && imageProviderUsed === 'simulation',
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
    imageProvider?: string,
    imageModel?: string,
  ) {
    const aiSettings = await this.getAiSettings();
    const activeImageProvider = imageProvider || aiSettings.defaultImageProvider || 'huggingface';
    const activeImageModel = imageModel || aiSettings.defaultImageModel || 'stabilityai/stable-diffusion-2-1';
    const fallbackImageProvider = aiSettings.fallbackImageProvider;
    const fallbackImageModel = aiSettings.fallbackImageModel;

    const logs: string[] = [];
    let finalPrompt = imagePrompt;
    let imageProviderUsed = activeImageProvider;
    let imageUrl = '';
    let imageError: string | undefined;

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
        } catch (error: any) {
          logs.push(`Prompt güncelleme sırasında hata: ${error.message}`);
        }
      } else {
        logs.push('GEMINI_API_KEY bulunamadı, feedback uygulanamadı.');
      }
    }

    try {
      logs.push(`Görsel ana model (${activeImageProvider} - ${activeImageModel}) ile yeniden üretiliyor...`);
      const res = await this.executeSingleImageProvider(
        activeImageProvider,
        activeImageModel,
        finalPrompt,
        finalPrompt,
        '',
        aiSettings,
        logs
      );
      imageUrl = res.imageUrl;
      imageProviderUsed = res.providerUsed;
      logs.push(`Görsel ana model (${imageProviderUsed}) ile başarıyla üretildi.`);
    } catch (err1: any) {
      this.logger.warn(`Ana görsel modeli (${activeImageProvider}) başarısız oldu: ${err1.message}`);
      logs.push(`Ana görsel modeli (${activeImageProvider}) hatası: ${err1.message}`);
      this.checkAiTokenError(err1, `Görsel Yeniden Üretim (${activeImageProvider})`);

      let fallbackSuccess = false;
      if (fallbackImageProvider && (fallbackImageProvider !== activeImageProvider || fallbackImageModel !== activeImageModel)) {
        try {
          logs.push(`Yedek görsel modeline (${fallbackImageProvider} - ${fallbackImageModel}) geçiliyor...`);
          const res = await this.executeSingleImageProvider(
            fallbackImageProvider,
            fallbackImageModel,
            finalPrompt,
            finalPrompt,
            '',
            aiSettings,
            logs
          );
          imageUrl = res.imageUrl;
          imageProviderUsed = `${res.providerUsed} (Yedek Model)`;
          logs.push(`Görsel yedek model (${imageProviderUsed}) ile başarıyla üretildi.`);
          fallbackSuccess = true;
        } catch (err2: any) {
          this.logger.warn(`Yedek görsel modeli (${fallbackImageProvider}) da başarısız oldu: ${err2.message}`);
          logs.push(`Yedek görsel modeli (${fallbackImageProvider}) hatası: ${err2.message}`);
          imageError = `Ana Model (${activeImageProvider}): ${err1.message} | Yedek Model (${fallbackImageProvider}): ${err2.message}`;
        }
      } else {
        imageError = `Ana Model (${activeImageProvider}): ${err1.message}`;
      }

      if (!fallbackSuccess && activeImageProvider !== 'pollinations' && fallbackImageProvider !== 'pollinations') {
        // Auto rescue with free Pollinations AI (FLUX)
        try {
          logs.push('Kurtarma modeli olarak ücretsiz Pollinations AI (FLUX) deneniyor...');
          const res = await this.executeSingleImageProvider(
            'pollinations',
            'flux',
            finalPrompt,
            finalPrompt,
            '',
            aiSettings,
            logs
          );
          imageUrl = res.imageUrl;
          imageProviderUsed = 'Pollinations AI (Otomatik Kurtarma)';
          logs.push(`Görsel kurtarma modeli (${imageProviderUsed}) ile başarıyla üretildi.`);
          fallbackSuccess = true;
        } catch (errRescue: any) {
          this.logger.warn(`Pollinations kurtarma modeli de başarısız oldu: ${errRescue.message}`);
        }
      }

      if (!fallbackSuccess) {
        const ts = Date.now();
        imageUrl = `https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80&sig=${ts}`;
        imageProviderUsed = 'simulation';
        logs.push('Simüle edilmiş Unsplash görseli atandı.');
      }
    }

    const savedImageUrl = imageUrl ? this.saveBase64Media(imageUrl, 'social-image') : imageUrl;

    return {
      imageUrl: savedImageUrl,
      imagePrompt: finalPrompt,
      imageProviderUsed,
      error: imageError,
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
        accountId: data.accountId ? parseInt(String(data.accountId), 10) : null,
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
        accountId: data.accountId !== undefined ? (data.accountId ? parseInt(String(data.accountId), 10) : null) : undefined,
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

    // Verify static image on disk if set
    let validCampaignImage = false;
    if (campaign.imageUrl) {
      const cleanPath = campaign.imageUrl.startsWith('/') ? campaign.imageUrl.substring(1) : campaign.imageUrl;
      const fullPath = path.join(process.cwd(), cleanPath);
      validCampaignImage = fs.existsSync(fullPath);
      if (!validCampaignImage) {
        this.logger.warn(`Kampanyaya ait sabit görsel diskte bulunamadı (${campaign.imageUrl}). Yapay zeka ile yeni görsel üretilecek.`);
      }
    }

    // Load default providers and models from global settings
    const aiSettings = await this.getAiSettings();
    const textProvider = aiSettings.defaultTextProvider || 'gemini';
    const textModel = aiSettings.defaultTextModel || 'gemini-2.5-flash';
    const imageProvider = aiSettings.defaultImageProvider || 'huggingface';
    const imageModel = aiSettings.defaultImageModel || 'stabilityai/stable-diffusion-2-1';

    // Generate content
    const genResult = await this.generatePost(
      campaign.prompt,
      campaign.platform,
      'Samimi',
      textProvider,
      imageProvider,
      'simulation',
      validCampaignImage ? false : true, // Only skip AI image if a valid static image exists on disk
      false, // Include video
      campaign.postType,
      textModel,
      imageModel
    );

    // Build comprehensive error message if models failed
    const cleanErrStr = (err: string) => {
      if (!err) return '';
      return err.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 300);
    };

    const errorList: string[] = [];
    if (genResult.textProviderUsed === 'simulation') {
      const msg = cleanErrStr(genResult.textGenerationError) || 'API anahtarı veya servis yanıt vermedi. Simülasyon metni kullanıldı.';
      errorList.push(`[Metin]: ${msg}`);
    }
    if (genResult.imageProviderUsed === 'simulation' && !validCampaignImage) {
      const msg = cleanErrStr(genResult.imageGenerationError) || 'Yapay zeka görseli üretilemedi (API kotası, anahtar hatası veya model kapalı). Stok görsel atandı.';
      errorList.push(`[Görsel]: ${msg}`);
    }
    const finalErrorMessage = errorList.length > 0 ? errorList.join(' | ') : null;

    // Create the post database record with status PENDING_APPROVAL
    const newPost = await this.prisma.socialMediaPost.create({
      data: {
        platform: campaign.platform,
        prompt: campaign.prompt,
        caption: genResult.caption,
        imageUrl: (validCampaignImage ? campaign.imageUrl : null) || genResult.imageUrl || null,
        videoUrl: null,
        postType: campaign.postType,
        status: 'PENDING_APPROVAL',
        campaignId: campaign.id,
        accountId: campaign.accountId,
        errorMessage: finalErrorMessage,
      },
    });

    let mediaLink = '';
    if (newPost.imageUrl) {
      mediaLink = `\n🖼️ <b>Görsel:</b> <a href="${this.getAbsoluteUrl(newPost.imageUrl)}">Görüntüle</a>\n`;
    }

    let warningText = '';
    if (finalErrorMessage) {
      const shortWarning = finalErrorMessage.length > 300 ? finalErrorMessage.substring(0, 300) + '...' : finalErrorMessage;
      warningText = `\n⚠️ <b>YAPAY ZEKA MODEL UYARISI:</b>\n<code>${this.escapeTelegramHtml(shortWarning)}</code>\n`;
    }

    const safeTitle = this.escapeTelegramHtml(campaign.title);
    const safePlatform = this.escapeTelegramHtml(campaign.platform);
    const safePostType = this.escapeTelegramHtml(campaign.postType);
    const safePrompt = this.escapeTelegramHtml(campaign.prompt);
    const safeCaption = this.escapeTelegramHtml(newPost.caption);

    const campaignMsg = `🔔 <b>ZAMANLANMIŞ GÖREV TEST ÇALIŞTIRMASI (ONAY BEKLİYOR)</b>\n\n` +
      `<b>Kampanya:</b> ${safeTitle}\n` +
      `<b>Platform:</b> ${safePlatform}\n` +
      `<b>Tür:</b> ${safePostType}\n` +
      `<b>Konu/Talimat:</b> <i>"${safePrompt}"</i>\n\n` +
      `<b>Metin:</b>\n<i>${safeCaption}</i>\n` +
      mediaLink +
      warningText;

    try {
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Onayla ve Paylaş', callback_data: `approve_publish_${newPost.id}` },
            { text: '❌ Reddet/Sil', callback_data: `reject_delete_${newPost.id}` },
          ],
        ],
      };
      await this.sendTelegramNotification(campaignMsg, replyMarkup, campaign.telegramId);
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

        // Verify static image on disk if set
        let validCampaignImage = false;
        if (campaign.imageUrl) {
          const cleanPath = campaign.imageUrl.startsWith('/') ? campaign.imageUrl.substring(1) : campaign.imageUrl;
          const fullPath = path.join(process.cwd(), cleanPath);
          validCampaignImage = fs.existsSync(fullPath);
        }

        // Load default providers and models from global settings
        const aiSettings = await this.getAiSettings();
        const textProvider = aiSettings.defaultTextProvider || 'gemini';
        const textModel = aiSettings.defaultTextModel || 'gemini-2.5-flash';
        const imageProvider = aiSettings.defaultImageProvider || 'huggingface';
        const imageModel = aiSettings.defaultImageModel || 'stabilityai/stable-diffusion-2-1';

        // Generate content
        this.logger.log(`Kampanya postu üretiliyor... Prompt: "${campaign.prompt}"`);
        const genResult = await this.generatePost(
          campaign.prompt,
          campaign.platform,
          'Samimi',
          textProvider,
          imageProvider,
          'simulation',
          validCampaignImage ? false : true,
          false, // Include video
          campaign.postType,
          textModel,
          imageModel
        );

        // Build comprehensive error message if models failed
        const cleanErrStr = (err: string) => {
          if (!err) return '';
          return err.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 300);
        };

        const errorList: string[] = [];
        if (genResult.textProviderUsed === 'simulation') {
          const msg = cleanErrStr(genResult.textGenerationError) || 'API anahtarı veya servis yanıt vermedi. Simülasyon metni kullanıldı.';
          errorList.push(`[Metin]: ${msg}`);
        }
        if (genResult.imageProviderUsed === 'simulation' && !validCampaignImage) {
          const msg = cleanErrStr(genResult.imageGenerationError) || 'Yapay zeka görseli üretilemedi (API kotası, anahtar hatası veya model kapalı). Stok görsel atandı.';
          errorList.push(`[Görsel]: ${msg}`);
        }
        const finalErrorMessage = errorList.length > 0 ? errorList.join(' | ') : null;

        // Create the post database record with status PENDING_APPROVAL
        const newPost = await this.prisma.socialMediaPost.create({
          data: {
            platform: campaign.platform,
            prompt: campaign.prompt,
            caption: genResult.caption,
            imageUrl: (validCampaignImage ? campaign.imageUrl : null) || genResult.imageUrl || null,
            videoUrl: null,
            postType: campaign.postType,
            status: 'PENDING_APPROVAL',
            campaignId: campaign.id,
            accountId: campaign.accountId,
            errorMessage: finalErrorMessage,
          },
        });

        this.logger.log(`Kampanya postu onay bekliyor... Post ID: ${newPost.id}`);

        let mediaLink = '';
        if (newPost.imageUrl) {
          mediaLink = `\n🖼️ <b>Görsel:</b> <a href="${this.getAbsoluteUrl(newPost.imageUrl)}">Görüntüle</a>\n`;
        }

        let warningText = '';
        if (finalErrorMessage) {
          const shortWarning = finalErrorMessage.length > 300 ? finalErrorMessage.substring(0, 300) + '...' : finalErrorMessage;
          warningText = `\n⚠️ <b>YAPAY ZEKA MODEL UYARISI:</b>\n<code>${this.escapeTelegramHtml(shortWarning)}</code>\n`;
        }

        const safeTitle = this.escapeTelegramHtml(campaign.title);
        const safePrompt = this.escapeTelegramHtml(campaign.prompt);
        const safeCaption = this.escapeTelegramHtml(newPost.caption);

        const campaignMsg = `🔔 <b>ZAMANLANMIŞ GÖREV (ONAY BEKLİYOR)</b>\n\n` +
          `<b>Kampanya:</b> ${safeTitle}\n` +
          `<b>Platform:</b> ${campaign.platform}\n` +
          `<b>Tür:</b> ${campaign.postType}\n` +
          `<b>Konu/Talimat:</b> <i>"${safePrompt}"</i>\n\n` +
          `<b>Metin:</b>\n<i>${safeCaption}</i>\n` +
          mediaLink +
          warningText;

        // Interactive inline buttons for Telegram
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Onayla ve Paylaş', callback_data: `approve_post_${newPost.id}` },
              { text: '❌ Reddet', callback_data: `reject_post_${newPost.id}` }
            ]
          ]
        };

        await this.sendTelegramNotification(campaignMsg, replyMarkup, campaign.telegramId);

      } catch (error) {
        this.logger.error(`Kampanya (#${campaign.id}) yürütülürken hata:`, error);
        try {
          await this.prisma.socialMediaCampaign.update({
            where: { id: campaign.id },
            data: { lastRunAt: campaign.lastRunAt },
          });
        } catch (dbError) {
          this.logger.error(`Kampanya (#${campaign.id}) lastRunAt geri alma hatası:`, dbError);
        }
        const errMsg = `❌ <b>KAMPANYA YÜRÜTÜLÜRKEN HATA OLUŞTU</b>\n\n` +
          `<b>Kampanya:</b> ${this.escapeTelegramHtml(campaign.title)} (#${campaign.id})\n` +
          `<b>Platform:</b> ${campaign.platform}\n` +
          `<b>Hata Nedeni:</b> <code>${this.escapeTelegramHtml(error.message)}</code>`;
        await this.sendTelegramNotification(errMsg, null, campaign.telegramId);
      }
    }
  }

  // --- Telegram Settings CRUD & Notifications ---
  // --- Telegram Settings CRUD & Notifications ---
  async getTelegramSettings() {
    return this.prisma.telegramSetting.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTelegramSetting(data: any) {
    return this.prisma.telegramSetting.create({
      data: {
        name: data.name ? data.name.trim() : 'Telegram Hesabı',
        botToken: data.botToken.trim(),
        chatId: data.chatId.trim(),
        isActive: data.isActive !== undefined ? data.isActive : true,
      }
    });
  }

  async updateTelegramSetting(id: number, data: any) {
    return this.prisma.telegramSetting.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        botToken: data.botToken ? data.botToken.trim() : undefined,
        chatId: data.chatId ? data.chatId.trim() : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      }
    });
  }

  async deleteTelegramSetting(id: number) {
    return this.prisma.telegramSetting.delete({
      where: { id }
    });
  }

  public escapeTelegramHtml(text?: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async sendTelegramNotification(message: string, replyMarkup?: any, specificTelegramId?: number | null) {
    try {
      let settings: any[] = [];
      if (specificTelegramId) {
        const single = await this.prisma.telegramSetting.findUnique({
          where: { id: specificTelegramId }
        });
        if (single && single.isActive) {
          settings = [single];
        } else {
          this.logger.warn(`Telegram setting #${specificTelegramId} not found or inactive. Falling back to active settings.`);
        }
      }
      
      if (settings.length === 0) {
        settings = await this.prisma.telegramSetting.findMany({
          where: { isActive: true }
        });
      }

      if (settings.length === 0) {
        this.logger.warn('No active Telegram settings found to send notification.');
        return;
      }

      for (const setting of settings) {
        if (!setting.botToken || !setting.chatId) continue;
        const url = `https://api.telegram.org/bot${setting.botToken}/sendMessage`;
        
        const MAX_TG_LEN = 3800;
        let textToSend = message;
        if (textToSend.length > MAX_TG_LEN) {
          textToSend = textToSend.substring(0, MAX_TG_LEN) + '\n\n...(mesaj sınırı nedeniyle kısaltıldı)';
        }

        // Primary attempt: HTML parse_mode
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: setting.chatId,
            text: textToSend,
            parse_mode: 'HTML',
            ...(replyMarkup && { reply_markup: replyMarkup }),
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.warn(`Telegram HTML notification error for setting #${setting.id} (${setting.name}): ${errText}. Attempting plain text fallback...`);
          
          // Fallback attempt: Plain text (strip basic HTML tags) to guarantee delivery even if HTML parsing fails
          let plainText = message
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?[^>]+(>|$)/g, '');
          if (plainText.length > MAX_TG_LEN) {
            plainText = plainText.substring(0, MAX_TG_LEN) + '\n\n...(mesaj sınırı nedeniyle kısaltıldı)';
          }

          const fallbackResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: setting.chatId,
              text: plainText,
              ...(replyMarkup && { reply_markup: replyMarkup }),
            }),
          });

          if (!fallbackResponse.ok) {
            const fallbackErrText = await fallbackResponse.text();
            this.logger.error(`Telegram plain text notification error for setting #${setting.id} (${setting.name}): ${fallbackErrText}`);
          } else {
            this.logger.log(`Telegram plain text fallback sent successfully for setting #${setting.id} (${setting.name}).`);
          }
        } else {
          this.logger.log(`Telegram bildirim mesajı başarıyla gönderildi: #${setting.id} (${setting.name}).`);
        }
      }
    } catch (err) {
      this.logger.error('Unexpected error in sendTelegramNotification:', err);
    }
  }

  @Cron('*/5 * * * * *')
  async handleTelegramPolling() {
    if (this.isPollingTelegram) return;
    this.isPollingTelegram = true;

    try {
      const settings = await this.prisma.telegramSetting.findMany({
        where: { isActive: true }
      });

      for (const setting of settings) {
        if (!setting.botToken) continue;
        const offset = this.telegramOffsets.get(setting.id) || 0;
        const url = `https://api.telegram.org/bot${setting.botToken}/getUpdates?offset=${offset}&timeout=2`;
        try {
          const response = await fetch(url);
          if (!response.ok) continue;

          const data = await response.json();
          if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
              this.telegramOffsets.set(setting.id, update.update_id + 1);

              if (update.callback_query) {
                const query = update.callback_query;
                const callbackData = query.data;
                const callbackQueryId = query.id;
                const chatId = query.message.chat.id;
                const messageId = query.message.message_id;

                if (callbackData.startsWith('approve_post_') || callbackData.startsWith('approve_publish_')) {
                  const postId = parseInt(
                    callbackData.replace('approve_post_', '').replace('approve_publish_', ''),
                    10
                  );

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
                    if (!post) throw new Error('Gönderi bulunamadı.');

                    if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') {
                      await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          chat_id: chatId,
                          message_id: messageId,
                          text: query.message.text + '\n\n✅ <b>Paylaşım Zaten Yapıldı.</b>',
                          parse_mode: 'HTML',
                        }),
                      });
                      continue;
                    }

                    // Update status to PUBLISHING
                    await this.prisma.socialMediaPost.update({
                      where: { id: postId },
                      data: { status: 'PUBLISHING' },
                    });

                    // Edit telegram message text
                    await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: query.message.text + '\n\n🔄 <b>Yayınlanıyor (Sıraya Alındı)...</b>',
                        parse_mode: 'HTML',
                      }),
                    });

                    // Run publish in background async
                    this.publishPost(postId).catch(err => {
                      this.logger.error(`Error publishing post ${postId} via telegram callback:`, err);
                    });

                  } catch (err) {
                    this.logger.error(`Approve callback failed for post ${postId}:`, err);
                    await fetch(`https://api.telegram.org/bot${setting.botToken}/sendMessage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `⚠️ Onaylama başarısız oldu: ${err.message}`,
                      }),
                    });
                  }
                } else if (callbackData.startsWith('reject_post_') || callbackData.startsWith('reject_delete_')) {
                  const postId = parseInt(
                    callbackData.replace('reject_post_', '').replace('reject_delete_', ''),
                    10
                  );

                  await fetch(`https://api.telegram.org/bot${setting.botToken}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      callback_query_id: callbackQueryId,
                      text: 'Gönderi reddedildi ve silindi.',
                    }),
                  });

                  try {
                    await this.prisma.socialMediaPost.delete({ where: { id: postId } });
                    await fetch(`https://api.telegram.org/bot${setting.botToken}/editMessageText`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: query.message.text + '\n\n❌ <b>Gönderi Reddedildi ve Silindi.</b>',
                        parse_mode: 'HTML',
                      }),
                    });
                  } catch (err) {
                    this.logger.error(`Reject callback failed for post ${postId}:`, err);
                  }
                }
              }
            }
          }
        } catch (fetchErr) {
          this.logger.error(`Error polling telegram setting #${setting.id}:`, fetchErr);
        }
      }
    } catch (err) {
      this.logger.error('Telegram polling cron job error:', err);
    } finally {
      this.isPollingTelegram = false;
    }
  }

  async sendTelegramTestMessage(id: number) {
    try {
      const setting = await this.prisma.telegramSetting.findUnique({
        where: { id }
      });
      if (!setting || !setting.botToken || !setting.chatId) {
        return {
          success: false,
          message: 'Telegram ayarı bulunamadı veya eksik.',
        };
      }

      const testMsg = `🔔 <b>SMYP Telegram Bildirim Testi (${setting.name})</b>\n\nBu mesaj Telegram entegrasyonunuzun başarıyla çalıştığını göstermektedir.\n\n📅 Tarih: ${new Date().toLocaleString('tr-TR')}`;
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
        return {
          success: false,
          message: `Telegram API Hatası: ${errText}`,
        };
      }

      return { success: true, message: `${setting.name} için test mesajı başarıyla gönderildi!` };
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

  private async generateHuggingFaceImage(modelPath: string, prompt: string, hfKey: string, logs?: string[]): Promise<string> {
    // Map common model aliases to active working Hugging Face model IDs
    let resolvedModel = modelPath || 'stabilityai/stable-diffusion-2-1';
    const modelLower = (modelPath || '').toLowerCase();
    if (modelLower === 'flux' || modelLower === 'flux-schnell' || modelLower === 'flux.1-schnell') {
      resolvedModel = 'black-forest-labs/FLUX.1-schnell';
    } else if (modelLower === 'flux-dev' || modelLower === 'flux.1-dev') {
      resolvedModel = 'black-forest-labs/FLUX.1-dev';
    } else if (modelLower === 'sdxl' || modelLower === 'stable-diffusion-xl' || modelLower.includes('stable-diffusion-xl-base-1.0') || modelLower.includes('stable-diffusion-3-medium')) {
      resolvedModel = 'stabilityai/stable-diffusion-2-1';
    }

    // Candidate models in preference order if first model returns 400, 410 (deprecated) or 404/503
    const candidateModels = [
      resolvedModel,
      'stabilityai/stable-diffusion-2-1',
      'runwayml/stable-diffusion-v1-5',
      'prompthero/openjourney',
      'CompVis/stable-diffusion-v1-4',
      'segmind/SSD-1B',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastErrorMsg = '';
    let lastStatus: number | undefined;

    for (const currModel of candidateModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout per candidate

      try {
        const endpoints = [
          `https://router.huggingface.co/hf-inference/models/${currModel}`,
          `https://api-inference.huggingface.co/models/${currModel}`,
        ];

        let response: Response | null = null;
        let lastErrText = '';

        for (const endpoint of endpoints) {
          try {
            response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${hfKey}`,
              },
              body: JSON.stringify({ inputs: prompt }),
              signal: controller.signal,
            });
            if (response.ok) break;
            lastErrText = await response.text();
            // If 400, 410 or 404, break to try next model in candidate list
            if (response.status === 400 || response.status === 410 || response.status === 404) break;
          } catch (fetchErr: any) {
            lastErrText = fetchErr.message;
          }
        }

        clearTimeout(timeoutId);

        if (response && response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          if (currModel !== resolvedModel && logs) {
            logs.push(`Hugging Face: "${resolvedModel}" sunucuda desteklenmediğinden alternatif model ("${currModel}") kullanılarak görsel başarıyla üretildi.`);
          }
          return `data:${contentType.includes('png') ? 'image/png' : 'image/jpeg'};base64,${base64}`;
        }

        lastStatus = response?.status;
        let errDetails = lastErrText;
        try {
          const errJson = JSON.parse(lastErrText);
          if (errJson && errJson.error) {
            errDetails = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
          }
        } catch {
          errDetails = lastErrText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        }
        if (errDetails.length > 200) errDetails = errDetails.substring(0, 200) + '...';

        lastErrorMsg = `Hugging Face (${currModel}) [${lastStatus || 'Bağlantı'}]: ${errDetails}`;

        // If 401/403 (invalid API key/token), stop and report token issue immediately
        if (lastStatus === 401 || lastStatus === 403) {
          break;
        }

        // For all other errors (400, 404, 410, 503, timeout), continue trying next candidate model!
        continue;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastErrorMsg = err.message;
        continue;
      }
    }

    if (lastStatus === 401) {
      throw new Error(`Hugging Face Yetkilendirme Hatası (401): Lütfen geçerli bir Hugging Face API Token girdiğinizden emin olun.`);
    } else if (lastStatus === 403) {
      throw new Error(`Hugging Face Erişim Reddedildi (403): Token izinleri veya model lisans kabulü eksik. Detay: ${lastErrorMsg}`);
    } else if (lastStatus === 410) {
      throw new Error(`Hugging Face (410): "${resolvedModel}" ve alternatif modeller Hugging Face ücretsiz sunucusunda şu anda kullanılamıyor. Lütfen model ayarlarından farklı bir görsel modeli veya Fal.ai / DALL-E seçin.`);
    }

    throw new Error(lastErrorMsg || `Hugging Face modelleri yanıt vermedi.`);
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
    const defaultModels = [
      'stabilityai/stable-diffusion-2-1',
      'runwayml/stable-diffusion-v1-5',
      'prompthero/openjourney',
      'CompVis/stable-diffusion-v1-4',
      'segmind/SSD-1B',
      'stabilityai/sdxl-turbo',
      'black-forest-labs/FLUX.1-schnell',
    ];

    const hasDeprecated = Array.isArray(settings.huggingFaceModels) && (settings.huggingFaceModels as string[]).some(m => 
      m.includes('stable-diffusion-xl-base-1.0') || m.includes('stable-diffusion-3-medium') || m.includes('playgroundai')
    );

    const updateData: any = {};

    if (!settings.huggingFaceModels || (Array.isArray(settings.huggingFaceModels) && settings.huggingFaceModels.length === 0) || hasDeprecated) {
      updateData.huggingFaceModels = defaultModels;
    }

    // Auto-migrate defaultImageModel if set to deprecated/410 FLUX.1-schnell on free Hugging Face
    if (settings.defaultImageProvider === 'huggingface' && (settings.defaultImageModel === 'black-forest-labs/FLUX.1-schnell' || settings.defaultImageModel === 'flux')) {
      updateData.defaultImageModel = 'stabilityai/stable-diffusion-2-1';
    }

    if (settings.fallbackImageProvider === 'huggingface' && (settings.fallbackImageModel === 'black-forest-labs/FLUX.1-schnell' || settings.fallbackImageModel === 'flux')) {
      updateData.fallbackImageModel = 'runwayml/stable-diffusion-v1-5';
    }

    if (Object.keys(updateData).length > 0) {
      settings = await this.prisma.aiModelSetting.update({
        where: { id: 'GLOBAL' },
        data: updateData,
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
        groqKey: data.groqKey,
        groqUrl: data.groqUrl,
        grokKey: data.grokKey,
        grokUrl: data.grokUrl,
        falKey: data.falKey,
        falUrl: data.falUrl,
        nvidiaKey: data.nvidiaKey,
        nvidiaUrl: data.nvidiaUrl,
        defaultTextProvider: data.defaultTextProvider,
        defaultTextModel: data.defaultTextModel,
        fallbackTextProvider: data.fallbackTextProvider,
        fallbackTextModel: data.fallbackTextModel,
        defaultImageProvider: data.defaultImageProvider,
        defaultImageModel: data.defaultImageModel,
        fallbackImageProvider: data.fallbackImageProvider,
        fallbackImageModel: data.fallbackImageModel,
        defaultVideoProvider: data.defaultVideoProvider,
        defaultVideoModel: data.defaultVideoModel,
        fallbackVideoProvider: data.fallbackVideoProvider,
        fallbackVideoModel: data.fallbackVideoModel,
        customModels: data.customModels || [],
        huggingFaceModels: data.huggingFaceModels || [],
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
        groqKey: data.groqKey,
        groqUrl: data.groqUrl || 'https://api.groq.com',
        grokKey: data.grokKey,
        grokUrl: data.grokUrl || 'https://api.x.ai',
        falKey: data.falKey,
        falUrl: data.falUrl || 'https://fal.run',
        nvidiaKey: data.nvidiaKey,
        nvidiaUrl: data.nvidiaUrl || 'https://integrate.api.nvidia.com/v1',
        defaultTextProvider: data.defaultTextProvider || 'gemini',
        defaultTextModel: data.defaultTextModel || 'gemini-2.5-flash',
        fallbackTextProvider: data.fallbackTextProvider || 'openai',
        fallbackTextModel: data.fallbackTextModel || 'gpt-4o-mini',
        defaultImageProvider: data.defaultImageProvider || 'huggingface',
        defaultImageModel: data.defaultImageModel || 'stabilityai/stable-diffusion-2-1',
        fallbackImageProvider: data.fallbackImageProvider || 'gemini',
        fallbackImageModel: data.fallbackImageModel || 'imagen-4.0-generate-001',
        defaultVideoProvider: data.defaultVideoProvider || 'fal',
        defaultVideoModel: data.defaultVideoModel || 'fal-ai/minimax/video-01',
        fallbackVideoProvider: data.fallbackVideoProvider || 'simulation',
        fallbackVideoModel: data.fallbackVideoModel || 'simulation',
        customModels: data.customModels || [],
        huggingFaceModels: data.huggingFaceModels || [],
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
          const list = data.models.map((m: any) => m.name.replace('models/', ''));
          // Filter out deprecated imagen-3 models if any returned
          const filtered = list.filter((m: string) => !m.startsWith('imagen-3'));
          if (!filtered.includes('imagen-4.0-generate-001')) {
            filtered.push('imagen-4.0-generate-001');
          }
          if (!filtered.includes('imagen-4.0-fast-generate-001')) {
            filtered.push('imagen-4.0-fast-generate-001');
          }
          return filtered;
        }
        return ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001'];
      } else {
        const headers: any = {};
        if (provider === 'claude') {
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const fetchUrl = cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`;
        const response = await fetch(fetchUrl, {
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

