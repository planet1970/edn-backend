import { PartialType } from '@nestjs/swagger';
import { CreatePageDefinitionDto } from './create-page-definition.dto';

export class UpdatePageDefinitionDto extends PartialType(CreatePageDefinitionDto) { }
