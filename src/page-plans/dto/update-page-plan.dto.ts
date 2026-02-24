import { PartialType } from '@nestjs/swagger';
import { CreatePagePlanDto } from './create-page-plan.dto';

export class UpdatePagePlanDto extends PartialType(CreatePagePlanDto) { }
