import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFoodPlaceDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    subtitle?: string;

    @IsOptional()
    @IsString()
    mainColor?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    backImageUrl?: string;

    @IsOptional()
    @IsString()
    campaignUrl?: string;

    @IsOptional()
    @IsString()
    badge?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    rating?: number;

    @IsOptional()
    @IsString()
    storyTitle?: string;

    @IsOptional()
    @IsString()
    frontContent?: string;

    @IsOptional()
    @IsString()
    backContent?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    hoursEveryday?: string;

    @IsOptional()
    @IsString()
    hoursMon?: string;

    @IsOptional()
    @IsString()
    hoursTue?: string;

    @IsOptional()
    @IsString()
    hoursWed?: string;

    @IsOptional()
    @IsString()
    hoursThu?: string;

    @IsOptional()
    @IsString()
    hoursFri?: string;

    @IsOptional()
    @IsString()
    hoursSat?: string;

    @IsOptional()
    @IsString()
    hoursSun?: string;

    @IsOptional()
    @IsString()
    menuItem1?: string;

    @IsOptional()
    @IsString()
    menuDesc1?: string;

    @IsOptional()
    @IsString()
    menuPrice1?: string;

    @IsOptional()
    @IsString()
    menuItem2?: string;

    @IsOptional()
    @IsString()
    menuDesc2?: string;

    @IsOptional()
    @IsString()
    menuPrice2?: string;

    @IsOptional()
    @IsString()
    menuItem3?: string;

    @IsOptional()
    @IsString()
    menuDesc3?: string;

    @IsOptional()
    @IsString()
    menuPrice3?: string;

    @IsOptional()
    @IsString()
    menuItem4?: string;

    @IsOptional()
    @IsString()
    menuDesc4?: string;

    @IsOptional()
    @IsString()
    menuPrice4?: string;

    @IsOptional()
    @IsString()
    menuItem5?: string;

    @IsOptional()
    @IsString()
    menuDesc5?: string;

    @IsOptional()
    @IsString()
    menuPrice5?: string;

    @IsOptional()
    @IsString()
    menuItem6?: string;

    @IsOptional()
    @IsString()
    menuDesc6?: string;

    @IsOptional()
    @IsString()
    menuPrice6?: string;

    @IsOptional()
    @IsString()
    menuItem7?: string;

    @IsOptional()
    @IsString()
    menuDesc7?: string;

    @IsOptional()
    @IsString()
    menuPrice7?: string;

    @IsOptional()
    @IsString()
    menuItem8?: string;

    @IsOptional()
    @IsString()
    menuDesc8?: string;

    @IsOptional()
    @IsString()
    menuPrice8?: string;

    @IsOptional()
    @IsString()
    menuItem9?: string;

    @IsOptional()
    @IsString()
    menuDesc9?: string;

    @IsOptional()
    @IsString()
    menuPrice9?: string;

    @IsOptional()
    @IsString()
    menuItem10?: string;

    @IsOptional()
    @IsString()
    menuDesc10?: string;

    @IsOptional()
    @IsString()
    menuPrice10?: string;

    @IsOptional()
    @IsString()
    features?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsString()
    field1?: string;

    @IsOptional()
    @IsString()
    field2?: string;

    @IsOptional()
    @IsString()
    field3?: string;

    @IsOptional()
    @IsString()
    field4?: string;

    @IsOptional()
    @IsString()
    field5?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @IsNumber()
    @Type(() => Number)
    subCategoryId: number;
}
