import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail({}, { message: 'Email is not valid' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
