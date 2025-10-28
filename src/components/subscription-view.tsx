"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider-new';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  getOrCreateSubscription, 
  createSubscriptionPayment, 
  checkPaymentStatus,
  getOrganizationPayments,
  cancelSubscription 
} from '@/app/actions-subscription';
import { CreditCard, Users, Calendar, AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Subscription = {
  id: string;
  status: string;
  agentCount: number;
  pricePerAgent: number;
  totalAmount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
};

type Payment = {
  id: string;
  amount: number;
  status: string;
  description: string | null;
  billingPeriod: string | null;
  agentCount: number | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export function SubscriptionView() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.organizationId) {
      loadSubscriptionData();
    }
  }, [userProfile?.organizationId]);

  const loadSubscriptionData = async () => {
    if (!userProfile?.organizationId) {
      console.log('[SubscriptionView] No organizationId found');
      return;
    }

    console.log('[SubscriptionView] Loading subscription for org:', userProfile.organizationId);
    setIsLoading(true);
    try {
      const [subResult, paymentsResult] = await Promise.all([
        getOrCreateSubscription(userProfile.organizationId),
        getOrganizationPayments(userProfile.organizationId),
      ]);

      console.log('[SubscriptionView] Subscription result:', subResult);
      console.log('[SubscriptionView] Payments result:', paymentsResult);

      if (subResult.success && subResult.subscription) {
        setSubscription(subResult.subscription);
      } else {
        console.error('[SubscriptionView] Failed to load subscription:', subResult.error);
        toast({
          variant: 'destructive',
          title: 'Subscription Error',
          description: subResult.error || 'Failed to load subscription',
        });
      }

      if (paymentsResult.success && paymentsResult.payments) {
        setPayments(paymentsResult.payments);
      }
    } catch (error) {
      console.error('[SubscriptionView] Error loading subscription data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load subscription data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!userProfile?.organizationId) return;

    setIsCreatingPayment(true);
    try {
      const result = await createSubscriptionPayment(userProfile.organizationId);

      if (result.success && result.paymentLink) {
        // Open payment in iframe modal (no toast notification)
        setPaymentUrl(result.paymentLink);
        setCurrentPaymentId(result.payment.id);

        // Reload data
        await loadSubscriptionData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to create payment link',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create payment',
      });
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handleClosePayment = async () => {
    setPaymentUrl(null);
    
    // Check payment status when closing
    if (currentPaymentId) {
      await handleCheckPayment(currentPaymentId);
    }
    
    setCurrentPaymentId(null);
  };

  const handleCheckPayment = async (paymentId: string) => {
    setIsCheckingPayment(paymentId);
    try {
      const result = await checkPaymentStatus(paymentId);

      if (result.success) {
        if (result.status === 'PAID') {
          toast({
            title: 'Payment Confirmed',
            description: 'Your subscription has been activated!',
          });
        } else {
          toast({
            title: 'Payment Status',
            description: `Payment is ${result.status.toLowerCase()}`,
          });
        }

        // Reload data
        await loadSubscriptionData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to check payment status',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to check payment status',
      });
    } finally {
      setIsCheckingPayment(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!userProfile?.organizationId) return;

    setIsCanceling(true);
    try {
      const result = await cancelSubscription(userProfile.organizationId);

      if (result.success) {
        toast({
          title: 'Subscription Canceled',
          description: 'Your subscription has been canceled',
        });
        await loadSubscriptionData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to cancel subscription',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel subscription',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      TRIAL: { label: 'Trial', variant: 'secondary' },
      ACTIVE: { label: 'Active', variant: 'default' },
      PAST_DUE: { label: 'Past Due', variant: 'destructive' },
      CANCELED: { label: 'Canceled', variant: 'outline' },
      EXPIRED: { label: 'Expired', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Subscription</AlertTitle>
        <AlertDescription>
          Unable to load subscription information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const isTrialActive = subscription.status === 'TRIAL' && subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
  const daysUntilTrialEnds = subscription.trialEndsAt 
    ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Trial Alert */}
      {isTrialActive && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Free Trial Active</AlertTitle>
          <AlertDescription>
            You have {daysUntilTrialEnds} day{daysUntilTrialEnds !== 1 ? 's' : ''} remaining in your free trial. 
            Your trial ends on {format(new Date(subscription.trialEndsAt!), 'MMMM d, yyyy')}.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Overview
          </CardTitle>
          <CardDescription>
            Manage your monthly subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Status</div>
              <div>{getStatusBadge(subscription.status)}</div>
            </div>

            {/* Agent Count */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Active Agents
              </div>
              <div className="text-2xl font-bold">{subscription.agentCount}</div>
            </div>

            {/* Monthly Cost */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Monthly Cost</div>
              <div className="text-2xl font-bold">
                ₱{subscription.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">
                ₱{subscription.pricePerAgent.toFixed(2)} per agent
              </div>
            </div>
          </div>

          {/* Billing Period */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Current period: {format(new Date(subscription.currentPeriodStart), 'MMM d, yyyy')} - {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              onClick={handleCreatePayment} 
              disabled={isCreatingPayment || subscription.status === 'CANCELED'}
            >
              {isCreatingPayment && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Pay Now
            </Button>

            {subscription.status !== 'CANCELED' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isCanceling}>
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel your subscription? You will lose access to all features at the end of your current billing period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscription}>
                      {isCanceling && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Subscription
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            View all your past payments and invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{payment.billingPeriod}</div>
                      {payment.description && (
                        <div className="text-xs text-muted-foreground">{payment.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{payment.agentCount || '-'}</TableCell>
                    <TableCell className="font-medium">
                      ₱{payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentStatusIcon(payment.status)}
                        <span className="text-sm">{payment.status}</span>
                      </div>
                      {payment.paidAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Paid {formatDistanceToNow(new Date(payment.paidAt), { addSuffix: true })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckPayment(payment.id)}
                          disabled={isCheckingPayment === payment.id}
                        >
                          {isCheckingPayment === payment.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            'Check Status'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal with Iframe */}
      <Dialog open={!!paymentUrl} onOpenChange={(open) => !open && handleClosePayment()}>
        <DialogContent className="max-w-2xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Complete Your Payment</DialogTitle>
            <DialogDescription>
              Complete your payment securely through PayMongo. Close this window when done.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-[600px]">
            {paymentUrl && (
              <iframe
                src={paymentUrl}
                className="w-full h-full border-0 rounded-md"
                title="PayMongo Payment"
                allow="payment"
              />
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Payment status will be checked automatically when you close this window.
            </p>
            <Button onClick={handleClosePayment} variant="outline">
              Close & Check Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
