import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RedisService } from '@/modules/redis/redis.service';

@Injectable()
export class ProductsService {
  private readonly CACHE_TTL = 60 * 5 * 1000; // 5 minutes

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly redisService: RedisService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const createdProduct = new this.productModel(createProductDto);
    const savedProduct = await createdProduct.save();
    await this.invalidateProductCache();
    return savedProduct;
  }

  async findAll(options: {
    page: number;
    limit: number;
    sortBy: string;
    order: string;
  }): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    // add default page and limit values and sortby and order values
    const defaultPage = 1;
    const defaultLimit = 10;
    const defaultSortBy = 'createdAt';
    const defaultOrder = 'desc';
    const page = options.page || defaultPage;
    const limit = options.limit || defaultLimit;
    const sortBy = options.sortBy || defaultSortBy;
    const order = options.order || defaultOrder;

    const cacheKey = `products:list:${page}:${limit}:${sortBy}:${order}`;
    const cachedData = await this.redisService.cacheGet(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const skip = (page - 1) * limit;
    const sort: { [key: string]: SortOrder } = {
      [sortBy]: order === 'asc' ? 1 : -1,
    };

    const [products, total] = await Promise.all([
      this.productModel.find().sort(sort).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(),
    ]);

    const result = { products, total, page, limit };
    await this.redisService.cacheSet(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  async findOne(id: string): Promise<Product> {
    const cacheKey = `products:${id}`;
    const cachedProduct = await this.redisService.cacheGet(cacheKey);

    if (cachedProduct) {
      return JSON.parse(cachedProduct);
    }

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.redisService.cacheSet(
      cacheKey,
      JSON.stringify(product),
      this.CACHE_TTL,
    );
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
      .exec();

    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.invalidateProductCache(id);
    return updatedProduct;
  }

  async remove(id: string): Promise<Product> {
    const deletedProduct = await this.productModel.findByIdAndDelete(id).exec();

    if (!deletedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.invalidateProductCache(id);
    return deletedProduct;
  }

  // Updates product stock atomically
  async updateStock(id: string, quantity: number): Promise<Product> {
    const lockToken = await this.redisService.acquireLock(`product:${id}`);

    if (!lockToken) {
      throw new Error('Failed to acquire lock for product stock update');
    }

    try {
      const product = await this.productModel.findById(id).exec();

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      if (product.stock < quantity) {
        throw new Error(`Not enough stock for product ${id}`);
      }

      product.stock -= quantity;
      const updatedProduct = await product.save();
      await this.invalidateProductCache(id);

      return updatedProduct;
    } finally {
      await this.redisService.releaseLock(`product:${id}`, lockToken);
    }
  }

  private async invalidateProductCache(id?: string): Promise<void> {
    if (id) {
      await this.redisService.cacheDelete(`products:${id}`);
    }
    await this.redisService.cacheInvalidatePattern('products:list:*');
  }

  // check if product has sufficient stock
  async checkStock(id: string, quantity: number): Promise<boolean> {
    const product = await this.productModel.findById(id).exec();
    return product && product.stock >= quantity;
  }

  // Used for restoring stock in case of failed checkout
  async incrementStock(id: string, quantity: number): Promise<Product> {
    const lockToken = await this.redisService.acquireLock(`product:${id}`);

    if (!lockToken) {
      throw new Error('Failed to acquire lock for product stock increment');
    }

    try {
      const product = await this.productModel.findById(id).exec();

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      product.stock += quantity;
      const updatedProduct = await product.save();
      await this.invalidateProductCache(id);

      return updatedProduct;
    } finally {
      await this.redisService.releaseLock(`product:${id}`, lockToken);
    }
  }

  async findByName(name: string): Promise<Product | null> {
    return await this.productModel
      .findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
      })
      .exec();
  }
}
