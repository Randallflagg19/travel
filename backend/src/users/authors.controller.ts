import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { UsersService } from './users.service';

@Controller('authors')
export class AuthorsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list() {
    return { items: await this.users.listAuthors() };
  }

  @Get('candidates')
  @AuthRoles('SUPERADMIN')
  async candidates() {
    return { items: await this.users.listAuthorCandidates() };
  }

  @Patch(':id/role')
  @AuthRoles('SUPERADMIN')
  async setRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { role?: 'AUTHOR' | 'USER' },
  ) {
    if (body?.role !== 'AUTHOR' && body?.role !== 'USER') {
      throw new BadRequestException('role must be AUTHOR or USER');
    }
    return { user: await this.users.setAuthorRole(id, body.role) };
  }
}
