import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/createUser.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/updateUser.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { ChangePasswordDto } from './dto/changePassword.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  registerUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.registerUser(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-profile')
  getMyProfile(@Req() req: any) {
    return this.usersService.getMyProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-profile')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }),
  )
  updateProfile(@Body() updateUserDto: UpdateUserDto, @Req() req: any) {
    return this.usersService.updateProfile(req.user.id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatarToSupabase(req.user.id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Body() changePassword: ChangePasswordDto, @Req() req: any) {
    return this.usersService.changePassword(req.user.id, changePassword);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
