import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateAdDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    discount?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    rating?: number;

    @IsOptional()
    @IsString()
    link?: string;

    @IsOptional()
    @IsBoolean()
    isNew?: boolean;

    @IsOptional()
    @IsNumber()
    order?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    sourceType?: string;

    @IsOptional()
    @IsNumber()
    sourceId?: number;
}
