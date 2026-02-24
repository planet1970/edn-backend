import { PartialType } from '@nestjs/swagger';
import { CreateWebHeroDto } from './create-web-hero.dto';

export class UpdateWebHeroDto extends PartialType(CreateWebHeroDto) { }
