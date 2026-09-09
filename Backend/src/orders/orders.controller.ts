import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, QuoteOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(String(request.user._id), dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findByUser(String(request.user._id));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.ordersService.findByIdForUser(id, String(request.user._id));
  }

  @Post('quote')
  quote(@Body() dto: QuoteOrderDto) {
    return this.ordersService.quote(dto);
  }
}
