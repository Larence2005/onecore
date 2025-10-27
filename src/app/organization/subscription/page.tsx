"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Users, DollarSign, Calendar, AlertCircle, CheckCircle } from "lucide-react";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    memberCount: number;
    pricePerMember: number;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    payments: Array<{
      id: string;
      amount: number;
      status: string;
      paidAt: string | null;
      createdAt: string;
    }>;
  } | null;
  activeAgentCount: number;
  isOwner: boolean;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [organizationId, setOrganizationId] = useState<string>("");

  useEffect(() => {
    // Get organization ID from localStorage or session
    const orgId = localStorage.getItem("currentOrganizationId");
    if (orgId) {
      setOrganizationId(orgId);
      fetchSubscriptionData(orgId);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No organization selected",
      });
      router.push("/dashboard");
    }
  }, []);

  const fetchSubscriptionData = async (orgId: string) => {
    try {
      const response = await fetch(`/api/subscription/status?organizationId=${orgId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch subscription data");
      }
      const data = await response.json();
      setSubscriptionData(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!subscriptionData) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          memberCount: subscriptionData.activeAgentCount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      
      // Redirect to PayMongo checkout
      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      TRIAL: { label: "Trial", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
      ACTIVE: { label: "Active", color: "bg-green-100 text-green-800", icon: CheckCircle },
      PAST_DUE: { label: "Past Due", color: "bg-red-100 text-red-800", icon: AlertCircle },
      CANCELED: { label: "Canceled", color: "bg-gray-100 text-gray-800", icon: AlertCircle },
      INCOMPLETE: { label: "Incomplete", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.TRIAL;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  if (!subscriptionData?.isOwner) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only organization owners can manage subscriptions.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const monthlyTotal = subscriptionData.activeAgentCount * (subscriptionData.subscription?.pricePerMember || 10);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground mt-2">Manage your organization's billing and subscription</p>
      </div>

      {/* Subscription Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptionData.activeAgentCount}</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyTotal)}</div>
            <p className="text-xs text-muted-foreground">
              ${subscriptionData.subscription?.pricePerMember || 10} per agent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mt-2">
              {subscriptionData.subscription
                ? getStatusBadge(subscriptionData.subscription.status)
                : getStatusBadge("TRIAL")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
          <CardDescription>Current billing period and payment information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionData.subscription ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Period</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(subscriptionData.subscription.currentPeriodStart)} -{" "}
                      {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Paid Members</p>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionData.subscription.memberCount} agents
                    </p>
                  </div>
                </div>
              </div>

              {subscriptionData.subscription.status === "ACTIVE" ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    ✓ Your subscription is active and in good standing.
                  </p>
                </div>
              ) : subscriptionData.subscription.status === "PAST_DUE" ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-medium">Payment Required</p>
                  <p className="text-sm text-red-700 mt-1">
                    Your last payment failed. Please update your payment method.
                  </p>
                  <Button onClick={handleSubscribe} className="mt-3" disabled={processing}>
                    {processing ? "Processing..." : "Pay Now"}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">No Active Subscription</p>
              <p className="text-sm text-blue-700 mt-1">
                Subscribe now to enable billing for your {subscriptionData.activeAgentCount} agent
                {subscriptionData.activeAgentCount !== 1 ? "s" : ""}.
              </p>
              <Button onClick={handleSubscribe} className="mt-3" disabled={processing}>
                {processing ? "Processing..." : `Subscribe - ${formatCurrency(monthlyTotal)}/month`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {subscriptionData.subscription?.payments && subscriptionData.subscription.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptionData.subscription.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      payment.status === "SUCCEEDED"
                        ? "bg-green-100 text-green-800"
                        : payment.status === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
