import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { ContactMessagesService } from './contact-messages.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('contact-messages')
export class ContactMessagesController {
    constructor(private readonly contactMessagesService: ContactMessagesService) { }

    @Post()
    create(@Body() createDto: { name: string; email: string; subject?: string; message: string }) {
        return this.contactMessagesService.create(createDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get()
    findAll() {
        return this.contactMessagesService.findAll();
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body('status') status: string,
        @Request() req,
    ) {
        return this.contactMessagesService.updateStatus(+id, status, req.user.userId);
    }
}
