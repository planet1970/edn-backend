import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubcategoryDto {
    @IsNotEmpty()
    @IsString()
    title: string;

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

    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    categoryId: number;

    @IsOptional()
    isActive?: boolean;
}
