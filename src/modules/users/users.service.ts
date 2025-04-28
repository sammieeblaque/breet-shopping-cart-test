import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { RedisService } from '@/modules/redis/redis.service';

@Injectable()
export class UsersService {
  private readonly CACHE_TTL = 60 * 30 * 1000;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel(createUserDto);
    const savedUser = await createdUser.save();
    await this.invalidateUserCache();
    return savedUser;
  }

  async findAll(): Promise<User[]> {
    const cacheKey = 'users:list';
    const cachedUsers = await this.redisService.cacheGet(cacheKey);

    if (cachedUsers) {
      return JSON.parse(cachedUsers);
    }

    const users = await this.userModel.find().exec();
    await this.redisService.cacheSet(
      cacheKey,
      JSON.stringify(users),
      this.CACHE_TTL,
    );

    return users;
  }

  async findOne(id: string): Promise<User> {
    const cacheKey = `users:${id}`;
    const cachedUser = await this.redisService.cacheGet(cacheKey);

    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    const user = await this.userModel.findById(id).lean().exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.redisService.cacheSet(
      cacheKey,
      JSON.stringify(user),
      this.CACHE_TTL,
    );
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Email should be unique, so we can safely return the first match
    return await this.userModel.findOne({
      email,
    });
  }

  private async invalidateUserCache(id?: string): Promise<void> {
    if (id) {
      await this.redisService.cacheDelete(`users:${id}`);
    }
    await this.redisService.cacheDelete('users:list');
  }
}
