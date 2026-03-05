import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdateSubcategoryDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    pageDesign?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    order?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    categoryId?: number;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    isActive?: boolean;
}
