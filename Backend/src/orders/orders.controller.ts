import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('orders')
@UseGuards(SessionAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(String(request.user._id), dto);
  }

  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findByUser(String(request.user._id));
  }
}
