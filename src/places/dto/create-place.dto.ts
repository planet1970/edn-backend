import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlaceDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    pic_url?: string;

    @IsOptional()
    @IsString()
    back_pic_url?: string;

    @IsOptional()
    @IsString()
    icon1?: string;

    @IsOptional()
    @IsString()
    title1?: string;

    @IsOptional()
    @IsString()
    info1?: string;

    @IsOptional()
    @IsString()
    icon2?: string;

    @IsOptional()
    @IsString()
    title2?: string;

    @IsOptional()
    @IsString()
    info2?: string;

    @IsOptional()
    @IsString()
    icon3?: string;

    @IsOptional()
    @IsString()
    title3?: string;

    @IsOptional()
    @IsString()
    info3?: string;

    @IsOptional()
    @IsString()
    icon4?: string;

    @IsOptional()
    @IsString()
    title4?: string;

    @IsOptional()
    @IsString()
    info4?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    rating?: number;

    @IsOptional()
    @IsString()
    panel1_title?: string;

    @IsOptional()
    @IsString()
    panel1?: string;

    @IsOptional()
    @IsString()
    panel2_title?: string;

    @IsOptional()
    @IsString()
    panel2?: string;

    @IsOptional()
    @IsString()
    panel_col_title?: string;

    @IsOptional()
    @IsString()
    panel_col?: string;

    @IsOptional()
    @IsString()
    panel3_title?: string;

    @IsOptional()
    @IsString()
    panel3?: string;

    @IsOptional()
    @IsString()
    panel4_title?: string;

    @IsOptional()
    @IsString()
    panel4?: string;

    @IsOptional()
    @IsString()
    panel_col_title2?: string;

    @IsOptional()
    @IsString()
    panel_col2?: string;

    @IsOptional()
    @IsString()
    panel5_title?: string;

    @IsOptional()
    @IsString()
    area1?: string;

    @IsOptional()
    @IsString()
    area2?: string;

    @IsOptional()
    @IsString()
    area3?: string;

    @IsOptional()
    @IsString()
    area4?: string;

    @IsOptional()
    @IsString()
    area5?: string;

    @IsOptional()
    @IsString()
    area6?: string;

    @IsOptional()
    @IsString()
    area7?: string;

    @IsOptional()
    @IsString()
    area8?: string;

    @IsOptional()
    @IsString()
    area9?: string;

    @IsOptional()
    @IsString()
    area10?: string;

    @IsOptional()
    @IsString()
    source?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    order?: number;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    categoryId?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    subCategoryId?: number;
}
