import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Gezilecek Yerler' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Tarihi ve doğal güzellikler', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Compass', required: false })
  @IsString()
  @IsOptional()
  iconName?: string;

  @ApiProperty({ example: 'fa-landmark', required: false })
  @IsString()
  @IsOptional()
  webIcon?: string;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ example: 'Gezilecek Yerler', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Tarihi ve doğal güzellikler', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Compass', required: false })
  @IsString()
  @IsOptional()
  iconName?: string;

  @ApiProperty({ example: 'fa-landmark', required: false })
  @IsString()
  @IsOptional()
  webIcon?: string;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  isActive?: boolean;
}
