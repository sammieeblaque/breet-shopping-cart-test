import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CartsService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {}

  async createCart(userId: string): Promise<CartDocument> {
    // Verify user exists
    await this.usersService.findOne(userId);

    const cart = new this.cartModel({
      userId,
      items: [],
      totalAmount: 0,
    });

    return cart.save();
  }

  async getCartByUserId(userId: string): Promise<CartDocument | null> {
    const cacheKey = `carts:user:${userId}`;
    const cachedCart = await this.redisService.cacheGet(cacheKey);

    if (cachedCart) {
      return JSON.parse(cachedCart);
    }

    // Find active cart that's not checked out
    const cart = await this.cartModel
      .findOne({ userId, checkedOut: false })
      .exec();

    if (cart) {
      await this.redisService.cacheSet(
        cacheKey,
        JSON.stringify(cart),
        60 * 1000,
      ); // 1 minute TTL for carts
    }

    return cart;
  }

  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartDocument> {
    const { productId, quantity } = addToCartDto;

    // Acquire a lock for this cart operation
    const lockToken = await this.redisService.acquireLock(`cart:${userId}`);
    if (!lockToken) {
      throw new Error('Failed to acquire lock for cart operation');
    }

    // File: carts/carts.service.ts (continued)
    try {
      // Get product details to verify stock and price
      const product = await this.productsService.findOne(productId);

      if (quantity > product.stock) {
        throw new BadRequestException(
          `Not enough stock available. Only ${product.stock} units left.`,
        );
      }

      // Get or create user cart
      let cart = await this.getCartByUserId(userId);

      if (!cart) {
        cart = await this.createCart(userId);
      }

      // Check if product already exists in cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId,
      );

      if (existingItemIndex !== -1) {
        // Update quantity if product already in cart
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;

        // Check stock again with updated quantity
        if (newQuantity > product.stock) {
          throw new BadRequestException(
            `Cannot add ${quantity} more units. Only ${product.stock} units available in total.`,
          );
        }

        cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new product to cart
        cart.items.push({
          productId,
          quantity,
          price: product.price,
          name: product.name,
        });
      }

      // Update total amount
      cart.totalAmount = cart.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );

      // Save cart
      const updatedCart = await cart.save();

      // Invalidate cache
      await this.redisService.cacheDelete(`carts:user:${userId}`);

      return updatedCart;
    } finally {
      // Release the lock
      await this.redisService.releaseLock(`cart:${userId}`, lockToken);
    }
  }

  async updateCartItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartDocument> {
    // Acquire lock
    const lockToken = await this.redisService.acquireLock(`cart:${userId}`);
    if (!lockToken) {
      throw new Error('Failed to acquire lock for cart operation');
    }

    try {
      // Verify product has enough stock
      const product = await this.productsService.findOne(productId);

      if (quantity > product.stock) {
        throw new BadRequestException(
          `Not enough stock available. Only ${product.stock} units left.`,
        );
      }

      // Get cart
      const cart = await this.cartModel
        .findOne({ userId, checkedOut: false })
        .exec();

      if (!cart) {
        throw new NotFoundException(`Active cart not found for user ${userId}`);
      }

      // Find item in cart
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId,
      );

      if (itemIndex === -1) {
        throw new NotFoundException(`Product ${productId} not found in cart`);
      }

      // Update quantity
      cart.items[itemIndex].quantity = quantity;

      // Recalculate total
      cart.totalAmount = cart.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );

      // Save cart
      const updatedCart = await cart.save();

      // Invalidate cache
      await this.redisService.cacheDelete(`carts:user:${userId}`);

      return updatedCart;
    } finally {
      // Release lock
      await this.redisService.releaseLock(`cart:${userId}`, lockToken);
    }
  }

  async removeFromCart(userId: string, productId: string): Promise<Cart> {
    // Acquire lock
    const lockToken = await this.redisService.acquireLock(`cart:${userId}`);
    if (!lockToken) {
      throw new Error('Failed to acquire lock for cart operation');
    }

    try {
      // Get cart
      const cart = await this.cartModel
        .findOne({ userId, checkedOut: false })
        .exec();

      if (!cart) {
        throw new NotFoundException(`Active cart not found for user ${userId}`);
      }

      // Remove item from cart
      const initialLength = cart.items.length;
      cart.items = cart.items.filter(
        (item) => item.productId.toString() !== productId,
      );

      if (cart.items.length === initialLength) {
        throw new NotFoundException(`Product ${productId} not found in cart`);
      }

      // Recalculate total
      cart.totalAmount = cart.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );

      // Save cart
      const updatedCart = await cart.save();

      // Invalidate cache
      await this.redisService.cacheDelete(`carts:user:${userId}`);

      return updatedCart;
    } finally {
      // Release lock
      await this.redisService.releaseLock(`cart:${userId}`, lockToken);
    }
  }

  async clearCart(userId: string): Promise<Cart> {
    // Acquire lock
    const lockToken = await this.redisService.acquireLock(`cart:${userId}`);
    if (!lockToken) {
      throw new Error('Failed to acquire lock for cart operation');
    }

    try {
      // Get cart
      const cart = await this.cartModel
        .findOne({ userId, checkedOut: false })
        .exec();

      if (!cart) {
        throw new NotFoundException(`Active cart not found for user ${userId}`);
      }

      // Clear items and reset total
      cart.items = [];
      cart.totalAmount = 0;

      // Save cart
      const updatedCart = await cart.save();

      // Invalidate cache
      await this.redisService.cacheDelete(`carts:user:${userId}`);

      return updatedCart;
    } finally {
      // Release lock
      await this.redisService.releaseLock(`cart:${userId}`, lockToken);
    }
  }

  async checkout(userId: string): Promise<Cart> {
    // Acquire lock for checkout operation
    const checkoutLock = await this.redisService.acquireLock(
      `checkout:${userId}`,
    );
    if (!checkoutLock) {
      throw new Error('Failed to acquire lock for checkout operation');
    }

    try {
      // Get cart
      const cart = await this.cartModel
        .findOne({ userId, checkedOut: false })
        .exec();

      if (!cart) {
        throw new NotFoundException(`Active cart not found for user ${userId}`);
      }

      if (cart.items.length === 0) {
        throw new BadRequestException('Cannot checkout an empty cart');
      }

      // Process each item and update inventory
      // We use a transaction to ensure all stock updates succeed or fail together
      const session = await this.cartModel.db.startSession();
      session.startTransaction();

      try {
        // Verify stock for all products before modifying anything
        for (const item of cart.items) {
          const hasStock = await this.productsService.checkStock(
            item.productId.toString(),
            item.quantity,
          );

          if (!hasStock) {
            throw new BadRequestException(
              `Not enough stock for product ${item.productId}`,
            );
          }
        }

        // Now update stock for all products
        for (const item of cart.items) {
          await this.productsService.updateStock(
            item.productId.toString(),
            item.quantity,
          );
        }

        // Mark cart as checked out
        cart.checkedOut = true;
        cart.checkedOutAt = new Date();

        // Save cart
        const checkedOutCart = await cart.save({ session });

        // Commit transaction
        await session.commitTransaction();

        // Invalidate cache
        await this.redisService.cacheDelete(`carts:user:${userId}`);

        return checkedOutCart;
      } catch (error) {
        // Rollback transaction if any operation fails
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } finally {
      // Release checkout lock
      await this.redisService.releaseLock(`checkout:${userId}`, checkoutLock);
    }
  }

  async getOrderHistory(userId: string): Promise<Cart[]> {
    return this.cartModel
      .find({ userId, checkedOut: true })
      .sort({ checkedOutAt: -1 })
      .exec();
  }
}
