import { IsString, IsOptional } from 'class-validator';

export class UpdateSocialInfoDto {
    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    facebook?: string;

    @IsString()
    @IsOptional()
    instagram?: string;

    @IsString()
    @IsOptional()
    twitter?: string;

    @IsString()
    @IsOptional()
    youtube?: string;
}
