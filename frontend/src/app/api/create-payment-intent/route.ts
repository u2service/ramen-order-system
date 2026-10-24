import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // 必要に応じてStripeのAPIバージョン等を指定
});

interface PaymentRequest {
  amount: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PaymentRequest;
    const { amount } = body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // JPYの場合は整数（例: 1000円 -> 1000）
      currency: 'jpy',
      // automatic_payment_methods ではなく payment_method_types で 'card' のみに絞り込みます
      payment_method_types: ['card'],
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}