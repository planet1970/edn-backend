import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
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
      body.includeVideo
    );
  }

  @Post('regenerate-image')
  @ApiOperation({ summary: 'Regenerate image from prompt and optional feedback/correction' })
  async regenerateImage(
    @Body() body: {
      imagePrompt: string;
      feedback?: string;
      imageProvider?: string;
    },
  ) {
    return this.socialMediaService.regenerateImage(
      body.imagePrompt,
      body.feedback,
      body.imageProvider,
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
}
