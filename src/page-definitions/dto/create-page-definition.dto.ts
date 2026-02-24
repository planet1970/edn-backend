import { IsString, IsBoolean, IsOptional, IsJSON } from 'class-validator';

export class CreatePageDefinitionDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsString()
    dbId: string;

    @IsJSON()
    fields: any;
}
