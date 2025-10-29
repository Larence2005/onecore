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
  cancelSubscription,
  cancelPendingPayment,
  getPaymentLink,
  buyAgentSlots,
  getAvailableSlots 
} from '@/app/actions-subscription';
import { getExchangeRateInfo } from '@/lib/currency';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
  const [isCancelingPayment, setIsCancelingPayment] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string>('Loading...');
  const [licensesToBuy, setLicensesToBuy] = useState<number>(1);
  const [isBuyingLicenses, setIsBuyingLicenses] = useState(false);
  const [availableLicenses, setAvailableLicenses] = useState<number>(0);
  const [totalLicenses, setTotalLicenses] = useState<number>(0);
  const [usedLicenses, setUsedLicenses] = useState<number>(0);

  useEffect(() => {
    if (userProfile?.organizationId) {
      loadSubscriptionData();
      loadExchangeRate();
      loadLicenseInfo();
    }
  }, [userProfile?.organizationId]);

  const loadLicenseInfo = async () => {
    if (!userProfile?.organizationId) return;
    
    try {
      const result = await getAvailableSlots(userProfile.organizationId);
      if (result.success) {
        setTotalLicenses(result.totalSlots);
        setUsedLicenses(result.usedSlots);
        setAvailableLicenses(result.availableSlots);
      }
    } catch (error) {
      console.error('[SubscriptionView] Error loading license info:', error);
    }
  };

  const loadExchangeRate = async () => {
    try {
      const rateInfo = await getExchangeRateInfo();
      setExchangeRate(rateInfo.formatted);
    } catch (error) {
      console.error('[SubscriptionView] Error loading exchange rate:', error);
      setExchangeRate('1 USD ≈ 56 PHP');
    }
  };

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
      // Check if user wants to buy licenses (licensesToBuy > 0)
      if (licensesToBuy > 0) {
        // Buy agent licenses
        const result = await buyAgentSlots(userProfile.organizationId, licensesToBuy);

        if (result.success && result.paymentLink) {
          setPaymentUrl(result.paymentLink);
          setCurrentPaymentId(result.payment.id);
          await loadSubscriptionData();
          await loadLicenseInfo();
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Failed to create payment for licenses',
          });
        }
      } else {
        // Regular subscription payment
        const result = await createSubscriptionPayment(userProfile.organizationId);

        if (result.success && result.paymentLink) {
          setPaymentUrl(result.paymentLink);
          setCurrentPaymentId(result.payment.id);
          await loadSubscriptionData();
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Failed to create payment',
          });
        }
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

  const handleOpenPaymentLink = async (paymentId: string) => {
    setIsCheckingPayment(paymentId);
    try {
      const result = await getPaymentLink(paymentId);

      if (result.success && result.paymentLink) {
        // Open payment in iframe modal
        setPaymentUrl(result.paymentLink);
        setCurrentPaymentId(paymentId);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to open payment link',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open payment link',
      });
    } finally {
      setIsCheckingPayment(null);
    }
  };

  const handleClosePayment = async () => {
    setPaymentUrl(null);
    
    // Check payment status when closing and reload all data
    if (currentPaymentId) {
      await handleCheckPayment(currentPaymentId);
    } else {
      // Even if no payment ID, reload data in case user completed payment
      await loadSubscriptionData();
      await loadLicenseInfo();
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

        // Reload all data including subscription and license info
        await loadSubscriptionData();
        await loadLicenseInfo();
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

  const handleCancelPendingPayment = async (paymentId: string) => {
    setIsCancelingPayment(paymentId);
    try {
      const result = await cancelPendingPayment(paymentId);

      if (result.success) {
        toast({
          title: 'Payment Canceled',
          description: 'The pending payment has been removed',
        });
        await loadSubscriptionData();
        await loadLicenseInfo();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to cancel payment',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel payment',
      });
    } finally {
      setIsCancelingPayment(null);
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
    switch (status) {
      case 'TRIAL':
        return <Badge variant="secondary" className="text-base px-3 py-1">Trial</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-green-600 hover:bg-green-700 text-white text-base px-3 py-1">Active</Badge>;
      case 'PAST_DUE':
        return <Badge variant="destructive" className="text-base px-3 py-1">Past Due</Badge>;
      case 'CANCELED':
        return <Badge variant="outline" className="text-base px-3 py-1">Canceled</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive" className="text-base px-3 py-1">Expired</Badge>;
      default:
        return <Badge variant="outline" className="text-base px-3 py-1">{status}</Badge>;
    }
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

  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const completedPayments = payments.filter(p => p.status !== 'PENDING');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
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

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Payments
            </CardTitle>
            <CardDescription>
              You have {pendingPayments.length} pending payment{pendingPayments.length !== 1 ? 's' : ''} that need{pendingPayments.length === 1 ? 's' : ''} to be completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
                <div className="space-y-1">
                  <div className="font-medium">{payment.billingPeriod}</div>
                  <div className="text-sm text-muted-foreground">
                    {payment.agentCount} agent{payment.agentCount !== 1 ? 's' : ''} • ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleOpenPaymentLink(payment.id)}
                    disabled={isCheckingPayment === payment.id || isCancelingPayment === payment.id}
                  >
                    {isCheckingPayment === payment.id ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      'Pay Now'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelPendingPayment(payment.id)}
                    disabled={isCheckingPayment === payment.id || isCancelingPayment === payment.id}
                  >
                    {isCancelingPayment === payment.id ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      'Cancel'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Subscription Overview */}
      <Card>
        {/* Exchange Rate Info - Announcement */}
        <div className="text-xs text-center text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 p-3">
          <span className="font-medium">Exchange Rate:</span> {exchangeRate} • Payments processed in Philippine Peso (PHP) via PayMongo
        </div>
        
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Status</div>
              <div>{getStatusBadge(subscription.status)}</div>
            </div>

            {/* Agent Licenses */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Agent Licenses
              </div>
              <div className="text-2xl font-bold">
                {usedLicenses}/{totalLicenses}
              </div>
              <div className="text-xs">
                {availableLicenses > 0 ? (
                  <span className="text-green-600">{availableLicenses} available</span>
                ) : (
                  <span className="text-red-600">0 available</span>
                )}
              </div>
            </div>

            {/* Agent without License */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Agent without License</div>
              <div className="text-2xl font-bold">{subscription.agentCount}</div>
              <div className="text-xs text-muted-foreground">
                Including admin
              </div>
            </div>

            {/* Monthly Cost */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Monthly Cost</div>
              <div className="text-2xl font-bold">
                ${subscription.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">
                ${subscription.pricePerAgent.toFixed(2)} per agent
              </div>
            </div>
          </div>

          {/* Buy Agent Licenses Section */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Buy Agent Licenses</h3>
                <p className="text-sm text-muted-foreground">Set the number of licenses to purchase, then use "Pay Now" button below</p>
              </div>
            </div>
            
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="licensesToBuy">Number of Licenses</Label>
                <Input
                  id="licensesToBuy"
                  type="number"
                  min={1}
                  max={100}
                  value={licensesToBuy}
                  onChange={(e) => setLicensesToBuy(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-xl font-bold">
                  ${(licensesToBuy * (subscription?.pricePerAgent || 10)).toFixed(2)} USD
                </div>
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
          {completedPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payment history yet
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedPayments.map((payment) => {
                  let statusLabel = payment.status;
                  let statusColor = 'text-gray-600';
                  
                  if (payment.status === 'PAID') {
                    statusLabel = 'Paid';
                    statusColor = 'text-green-600';
                  } else if (payment.status === 'FAILED') {
                    statusLabel = 'Overdue';
                    statusColor = 'text-red-600';
                  } else if (payment.status === 'CANCELED') {
                    statusLabel = 'Canceled';
                    statusColor = 'text-gray-600';
                  }
                  
                  return (
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
                        ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentStatusIcon(payment.status)}
                          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
                        </div>
                        {payment.paidAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Paid {formatDistanceToNow(new Date(payment.paidAt), { addSuffix: true })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal with Iframe */}
      <Dialog open={!!paymentUrl} onOpenChange={(open) => !open && handleClosePayment()}>
        <DialogContent className="max-w-xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>Complete Your Payment</DialogTitle>
            <DialogDescription>
              Complete your payment securely through PayMongo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-[500px] overflow-auto">
            {paymentUrl && (
              <iframe
                src={paymentUrl}
                className="w-full h-full border-0 rounded-md"
                title="PayMongo Payment"
                allow="payment"
                style={{ minWidth: '100%', minHeight: '100%' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
