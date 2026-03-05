import { PartialType } from '@nestjs/swagger';
import { CreatePlaceDto } from './create-place.dto';

import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePlaceDto extends PartialType(CreatePlaceDto) {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    isActive?: boolean;
}
