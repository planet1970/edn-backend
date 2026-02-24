import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateNavbarDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    titleColor?: string;

    @IsString()
    @IsOptional()
    fontFamily?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    fontSize?: number;

    @IsString()
    @IsOptional()
    logoUrl?: string;

    @IsString()
    @IsOptional()
    bgColor?: string;

    @IsString()
    @IsOptional()
    iconColor?: string;
}
