import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartsService } from './carts.service';

@ApiTags('carts')
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user cart' })
  @ApiResponse({ status: 200, description: 'Return the user cart.' })
  async getUserCart(@Param('userId') userId: string) {
    const cart = await this.cartsService.getCartByUserId(userId);
    if (!cart) {
      // Create a new cart if one doesn't exist
      return this.cartsService.createCart(userId);
    }
    return cart;
  }

  @Post('user/:userId/items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart successfully.' })
  async addToCart(
    @Param('userId') userId: string,
    @Body() addToCartDto: AddToCartDto,
  ) {
    try {
      return await this.cartsService.addToCart(userId, addToCartDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Put('user/:userId/items/:productId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated successfully.' })
  async updateCartItem(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    try {
      return await this.cartsService.updateCartItem(
        userId,
        productId,
        updateCartItemDto.quantity,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete('user/:userId/items/:productId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({
    status: 200,
    description: 'Item removed from cart successfully.',
  })
  async removeFromCart(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    try {
      return await this.cartsService.removeFromCart(userId, productId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('user/:userId/checkout')
  @ApiOperation({ summary: 'Checkout user cart' })
  @ApiResponse({ status: 200, description: 'Cart checked out successfully.' })
  async checkout(@Param('userId') userId: string) {
    try {
      return await this.cartsService.checkout(userId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete('user/:userId')
  @ApiOperation({ summary: 'Clear user cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully.' })
  async clearCart(@Param('userId') userId: string) {
    try {
      return await this.cartsService.clearCart(userId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
