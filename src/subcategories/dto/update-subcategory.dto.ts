import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

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
    isActive?: boolean;
}
