import { PartialType } from '@nestjs/swagger';
import { CreateFoodPlaceDto } from './create-food-place.dto';

export class UpdateFoodPlaceDto extends PartialType(CreateFoodPlaceDto) { }
