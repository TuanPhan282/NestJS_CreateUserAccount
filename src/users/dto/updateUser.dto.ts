import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @IsNotEmpty({ message: 'Email must not be empty' })
  email?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Fullname must not be empty' })
  fullname?: string;

  @IsOptional()
  displayName?: string;
}
