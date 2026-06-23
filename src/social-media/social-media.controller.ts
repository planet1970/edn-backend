import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SocialMediaService } from './social-media.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('social-media')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('social-media')
export class SocialMediaController {
  constructor(private readonly socialMediaService: SocialMediaService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate post caption, image or video using customizable AI providers' })
  async generatePost(
    @Body() body: { 
      prompt: string; 
      platform: string; 
      tone: string;
      textProvider?: string;
      imageProvider?: string;
      videoProvider?: string;
      includeImage?: boolean;
      includeVideo?: boolean;
      postType?: string;
    },
  ) {
    return this.socialMediaService.generatePost(
      body.prompt, 
      body.platform, 
      body.tone,
      body.textProvider,
      body.imageProvider,
      body.videoProvider,
      body.includeImage,
      body.includeVideo,
      body.postType
    );
  }

  @Post('regenerate-image')
  @ApiOperation({ summary: 'Regenerate image from prompt and optional feedback/correction' })
  async regenerateImage(
    @Body() body: {
      imagePrompt: string;
      feedback?: string;
      imageProvider?: string;
      imageModel?: string;
    },
  ) {
    return this.socialMediaService.regenerateImage(
      body.imagePrompt,
      body.feedback,
      body.imageProvider,
      body.imageModel,
    );
  }

  // --- Accounts ---
  @Get('accounts')
  @ApiOperation({ summary: 'Get all configured social media accounts' })
  async getAccounts() {
    return this.socialMediaService.getAccounts();
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create a new social media account' })
  async createAccount(@Body() body: any) {
    return this.socialMediaService.createAccount(body);
  }

  @Put('accounts/:id')
  @ApiOperation({ summary: 'Update a social media account' })
  async updateAccount(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.socialMediaService.updateAccount(id, body);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Delete a social media account' })
  async deleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.deleteAccount(id);
  }

  @Post('accounts/:id/test')
  @ApiOperation({ summary: 'Test connection credentials for a social media account' })
  async testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.testConnection(id);
  }

  // --- Posts ---
  @Get('posts')
  @ApiOperation({ summary: 'Get all social media posts (drafts, scheduled, published)' })
  async getPosts() {
    return this.socialMediaService.getPosts();
  }

  @Post('posts')
  @ApiOperation({ summary: 'Create a new social media post (e.g. save draft/schedule)' })
  async createPost(@Body() body: any) {
    return this.socialMediaService.createPost(body);
  }

  @Put('posts/:id')
  @ApiOperation({ summary: 'Update a social media post' })
  async updatePost(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.socialMediaService.updatePost(id, body);
  }

  @Post('posts/:id/media')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image or video file for a post' })
  async uploadPostMedia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.socialMediaService.uploadPostMedia(id, file);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete a social media post' })
  async deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.deletePost(id);
  }

  @Post('posts/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a post immediately (calls API or simulates)' })
  async publishPost(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.publishPost(id);
  }

  // --- Campaigns ---
  @Get('campaigns')
  @ApiOperation({ summary: 'Get all configured social media campaigns' })
  async getCampaigns() {
    return this.socialMediaService.getCampaigns();
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a new social media campaign' })
  async createCampaign(@Body() body: any) {
    return this.socialMediaService.createCampaign(body);
  }

  @Put('campaigns/:id')
  @ApiOperation({ summary: 'Update a social media campaign' })
  async updateCampaign(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.socialMediaService.updateCampaign(id, body);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete a social media campaign' })
  async deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.deleteCampaign(id);
  }

  @Post('campaigns/:id/toggle')
  @ApiOperation({ summary: 'Toggle campaign active status' })
  async toggleCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.socialMediaService.toggleCampaign(id);
  }

  // --- Telegram Settings ---
  @Get('telegram')
  @ApiOperation({ summary: 'Get current Telegram notification settings' })
  async getTelegramSetting() {
    return this.socialMediaService.getTelegramSetting();
  }

  @Post('telegram')
  @ApiOperation({ summary: 'Save or update Telegram notification settings' })
  async saveTelegramSetting(@Body() body: { botToken: string; chatId: string; isActive: boolean }) {
    return this.socialMediaService.saveTelegramSetting(body);
  }

  @Post('telegram/test')
  @ApiOperation({ summary: 'Send a test notification to Telegram' })
  async testTelegram() {
    return this.socialMediaService.sendTelegramTestMessage();
  }

  // --- AI Model Settings ---
  @Get('ai-settings')
  @ApiOperation({ summary: 'Get global AI model settings (API keys, endpoints)' })
  async getAiSettings() {
    return this.socialMediaService.getAiSettings();
  }

  @Post('ai-settings')
  @ApiOperation({ summary: 'Save global AI model settings' })
  async saveAiSettings(@Body() body: any) {
    return this.socialMediaService.saveAiSettings(body);
  }

  @Post('ai-settings/fetch-models')
  @ApiOperation({ summary: 'Fetch available models from an API URL using API Key' })
  async fetchModels(
    @Body() body: { apiUrl: string; apiKey: string; provider: string }
  ) {
    return this.socialMediaService.fetchModels(body.apiUrl, body.apiKey, body.provider);
  }
}

