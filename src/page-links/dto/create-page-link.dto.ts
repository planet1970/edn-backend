import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePageLinkDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsString()
    slug: string;

    @IsOptional()
    @IsString()
    targetTable?: string;
}
