import { PartialType } from '@nestjs/mapped-types';
import { SignInDto } from './signIn.dto';

export class RegisterDto extends PartialType(SignInDto) {}
