import { PartialType } from '@nestjs/swagger';
import { CreateFoodPlaceDto } from './create-food-place.dto';

import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateFoodPlaceDto extends PartialType(CreateFoodPlaceDto) {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    isActive?: boolean;
}
