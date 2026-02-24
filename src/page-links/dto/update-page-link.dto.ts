import { PartialType } from '@nestjs/mapped-types';
import { CreatePageLinkDto } from './create-page-link.dto';

export class UpdatePageLinkDto extends PartialType(CreatePageLinkDto) { }
