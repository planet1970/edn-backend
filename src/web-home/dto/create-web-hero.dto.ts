import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWebHeroDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    subtitle?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    order?: number;

    @IsString()
    @IsOptional()
    titleColor?: string;

    @IsString()
    @IsOptional()
    subtitleColor?: string;

    @IsString()
    @IsOptional()
    descriptionColor?: string;

    @IsString()
    @IsOptional()
    titleShadowColor?: string;
}
