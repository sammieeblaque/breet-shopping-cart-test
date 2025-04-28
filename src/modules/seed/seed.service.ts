import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.seedUsers();
    await this.seedProducts();
    console.log('Seeding completed successfully');
  }

  private async seedUsers() {
    console.log('Starting user seeding...');
    const users = [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
      { name: 'Bob Johnson', email: 'bob@example.com' },
    ];

    for (const user of users) {
      try {
        // Check if user exists before creating
        const existingUser = await this.usersService.findByEmail(user.email);
        if (existingUser) {
          console.log(`User with email ${user.email} already exists, skipping`);
          continue;
        }

        await this.usersService.create(user);
        console.log(`User ${user.name} created successfully`);
      } catch (error) {
        console.error(`Error while creating user ${user.name}:`, error.message);
      }
    }
    console.log('User seeding completed');
  }

  private async seedProducts() {
    console.log('Starting product seeding...');
    const products = [
      {
        name: 'Smartphone',
        description: 'High-end smartphone with advanced features',
        price: 899.99,
        stock: 50,
      },
      {
        name: 'Laptop',
        description: 'Powerful laptop for professional use',
        price: 1299.99,
        stock: 30,
      },
      {
        name: 'Wireless Headphones',
        description: 'Noise-cancelling wireless headphones',
        price: 199.99,
        stock: 100,
      },
      {
        name: 'Smart Watch',
        description: 'Fitness tracking smart watch',
        price: 249.99,
        stock: 75,
      },
      {
        name: 'Tablet',
        description: '10-inch tablet with high resolution display',
        price: 499.99,
        stock: 40,
      },
    ];

    for (const product of products) {
      try {
        // Check if product exists before creating
        const existingProduct = await this.productsService.findByName(
          product.name,
        );
        if (existingProduct) {
          console.log(`Product "${product.name}" already exists, skipping`);
          continue;
        }

        await this.productsService.create(product);
        console.log(`Product "${product.name}" created successfully`);
      } catch (error) {
        console.error(
          `Error while creating product "${product.name}":`,
          error.message,
        );
      }
    }
    console.log('Product seeding completed');
  }
}
