import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreatePagePlanDto {
    @IsInt()
    categoryId: number;

    @IsInt()
    subCategoryId: number;

    @IsString()
    pageDefinitionId: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    source?: string;

    @IsOptional()
    @IsString()
    pageTitle?: string;
}
