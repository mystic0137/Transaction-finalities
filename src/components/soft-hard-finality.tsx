"use client";

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from 'lucide-react';

// Dynamically import Joyride with SSR disabled - This fixes the hydration error
const Joyride = dynamic(() => import('react-joyride'), { ssr: false });

interface Order {
  id: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  price?: number;
  quantity: number;
  timestamp: Date;
  status: 'pending' | 'executed' | 'reverted' | 'permanent' | 'cancelled';
  finalityType?: 'soft' | 'hard';
  originalBalance?: number;
  newBalance?: number;
}

interface TourCallbackData {
  status: string;
  type?: string;
  index?: number;
  action?: string;
}

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2)}-${Math.floor(Math.random() * 10000)}`;
};

function SoftHardFinalityComponent() {
  const [balance, setBalance] = useState(50000);
  const [currentPrice] = useState(85.42);
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [activeTab, setActiveTab] = useState<'market' | 'limit'>('market');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  const [latestMessage, setLatestMessage] = useState("");
  const [selectedFinalityType, setSelectedFinalityType] = useState<'soft' | 'hard'>('soft');
  const [softFinalityRevertChance] = useState(0.5);
  const chartRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef<Set<string>>(new Set());

  // Theme state - dark mode as default
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Tour state
  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('finality-theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  // Save theme preference and apply to document
  useEffect(() => {
    localStorage.setItem('finality-theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Theme toggle function
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Tour steps configuration (updated to include theme toggle)
  const tourSteps = [
    {
      target: '.tour-welcome',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Welcome to CryptoExchange Pro! 🎉</h3>
          <p>This interactive demo will teach you about blockchain finality types and how they affect your trading experience.</p>
        </div>
      ),
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '.tour-theme-toggle',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Theme Toggle 🌙☀️</h3>
          <p>Switch between dark and light mode for comfortable viewing during finality simulation.</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>🌙 <strong>Dark Mode:</strong> Easy on the eyes for extended trading</p>
            <p>☀️ <strong>Light Mode:</strong> Classic bright interface</p>
            <p>💾 <strong>Persistent:</strong> Your preference is saved</p>
          </div>
        </div>
      ),
    },
    {
      target: '.tour-balance',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Your Trading Balance 💰</h3>
          <p>This shows your current balance. Watch how it changes with different finality types when you place orders!</p>
        </div>
      ),
    },
    {
      target: '.tour-finality-selection',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Finality Type Selection 🔄</h3>
          <p><strong>Soft Finality:</strong> 50% chance your transaction might be reverted due to chain reorganization.</p>
          <p><strong>Hard Finality:</strong> 100% permanent - transactions are immediately final with cryptographic proof.</p>
        </div>
      ),
    },
    {
      target: '.tour-trading-tabs',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Trading Options 📊</h3>
          <p><strong>Market:</strong> Execute immediately at current price</p>
          <p><strong>Limit:</strong> Set your desired price and wait for execution</p>
        </div>
      ),
    },
    {
      target: '.tour-quantity-input',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Enter Trade Details 📝</h3>
          <p>Enter the quantity of SOL you want to trade. Try entering &quot;10&quot; to see how it works!</p>
        </div>
      ),
    },
    {
      target: '.tour-trade-buttons',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Execute Your Trade 🚀</h3>
          <p>Click Buy or Sell to place your order. The order will be processed with your selected finality type.</p>
        </div>
      ),
    },
    {
      target: '.tour-pending-orders',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Order Management 📋</h3>
          <p>Pending orders appear here. You can drag orders to the cancel zone to cancel them before execution.</p>
        </div>
      ),
    },
    {
      target: '.tour-order-history',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Order History 📈</h3>
          <p>Watch your order status change:</p>
          <ul className="text-sm mt-2 space-y-1">
            <li>✅ <strong>EXECUTED:</strong> Order processed</li>
            <li>🔒 <strong>PERMANENT:</strong> Hard finality confirmed</li>
            <li>↩️ <strong>REVERTED:</strong> Soft finality reversed</li>
          </ul>
        </div>
      ),
    },
    {
      target: '.tour-statistics',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Finality Statistics 📊</h3>
          <p>Track how often soft finality transactions become permanent vs. reverted. This helps you understand the real-world implications of different finality types.</p>
        </div>
      ),
    },
    {
      target: '.tour-help-button',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2">Need Help? 🆘</h3>
          <p>Click this button anytime to restart the tour. Now you&apos;re ready to explore blockchain finality!</p>
          <p className="mt-2 text-green-600 font-semibold">Try placing a few orders with different finality types to see the difference!</p>
        </div>
      ),
    },
  ];

  const handleTourCallback = (data: TourCallbackData) => {
    const { status } = data;
    const finishedStatuses = ["finished", "skipped"];
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
    }
  };

  const startTour = () => {
    setRunTour(false);
    setTimeout(() => {
      setTourKey(prev => prev + 1);
      setRunTour(true);
    }, 100);
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { 
          color: isDarkMode ? "#1f2937" : "#ffffff", 
          type: ColorType.Solid 
        },
        textColor: isDarkMode ? "#e5e7eb" : "#1f2937",
      },
      width: 800,
      height: 400,
      grid: {
        vertLines: { color: isDarkMode ? "#374151" : "#f3f4f6" },
        horzLines: { color: isDarkMode ? "#374151" : "#f3f4f6" },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const data = [];
    let price = 85;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 3;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - (30 - i));
      const timeString = targetDate.toISOString().split('T')[0];
      
      data.push({
        time: timeString,
        open: Math.max(0, open),
        high: Math.max(0, high),
        low: Math.max(0, low),
        close: Math.max(0, close),
      });
      price = close;
    }

    series.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [isDarkMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingOrders(currentPending => {
        if (currentPending.length === 0) return currentPending;
        
        const orderToProcess = currentPending.find(order => !processingRef.current.has(order.id));
        
        if (!orderToProcess) return currentPending;
        
        processingRef.current.add(orderToProcess.id);
        
        const orderValue = orderToProcess.quantity * (orderToProcess.price || currentPrice);
        const originalBalance = balance;
        const newBalance = orderToProcess.type === 'buy' 
          ? originalBalance - orderValue 
          : originalBalance + orderValue;
        
        setBalance(newBalance);
        
        const finalityType = orderToProcess.finalityType!;
        
        const executedOrder: Order = {
          ...orderToProcess,
          status: 'executed',
          finalityType,
          originalBalance,
          newBalance
        };
        
        setOrders(prevOrders => {
          const orderExists = prevOrders.some(existingOrder => existingOrder.id === orderToProcess.id);
          if (orderExists) return prevOrders;
          
          return [executedOrder, ...prevOrders.slice(0, 4)];
        });
        
        setLatestMessage(`Order executed successfully (${finalityType} finality) - Balance updated to $${newBalance.toLocaleString()}`);
        setShowOrderStatus(true);
        setTimeout(() => setShowOrderStatus(false), 3000);
        
        setTimeout(() => {
          if (finalityType === 'soft') {
            const willRevert = Math.random() < softFinalityRevertChance;
            
            if (willRevert) {
              setBalance(originalBalance);
              
              setOrders(prevOrders => 
                prevOrders.map(order => 
                  order.id === orderToProcess.id 
                    ? { ...order, status: 'reverted' as const }
                    : order
                )
              );
              
              setLatestMessage(`Soft finality: Transaction reverted due to chain reorganization - Balance restored to $${originalBalance.toLocaleString()}`);
              setShowOrderStatus(true);
              setTimeout(() => setShowOrderStatus(false), 4000);
            } else {
              setOrders(prevOrders => 
                prevOrders.map(order => 
                  order.id === orderToProcess.id 
                    ? { ...order, status: 'permanent' as const }
                    : order
                )
              );
              
              setLatestMessage(`Soft finality: Transaction confirmed permanently after network consensus - Final balance: $${newBalance.toLocaleString()}`);
              setShowOrderStatus(true);
              setTimeout(() => setShowOrderStatus(false), 4000);
            }
          } else {
            setOrders(prevOrders => 
              prevOrders.map(order => 
                order.id === orderToProcess.id 
                  ? { ...order, status: 'permanent' as const }
                  : order
              )
            );
            
            setLatestMessage(`Hard finality: Transaction confirmed with cryptographic proof - Final balance: $${newBalance.toLocaleString()}`);
            setShowOrderStatus(true);
            setTimeout(() => setShowOrderStatus(false), 4000);
          }
        }, 2000);
        
        processingRef.current.delete(orderToProcess.id);
        return currentPending.filter(order => order.id !== orderToProcess.id);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [balance, currentPrice, softFinalityRevertChance]);

  const handleTrade = (type: 'buy' | 'sell', orderType: 'market' | 'limit') => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return;

    const price = orderType === 'limit' ? parseFloat(limitPrice) : currentPrice;
    const orderValue = qty * price;
    
    if (type === 'buy' && orderValue > balance) {
      setLatestMessage("Insufficient balance for this order");
      setShowOrderStatus(true);
      setTimeout(() => setShowOrderStatus(false), 3000);
      return;
    }

    const newOrder: Order = {
      id: generateUniqueId(),
      type,
      orderType,
      price: price,
      quantity: qty,
      timestamp: new Date(),
      status: 'pending',
      finalityType: selectedFinalityType
    };

    setPendingOrders(prev => [...prev, newOrder]);
    
    setQuantity("");
    setLimitPrice("");
  };

  const handleDragStart = (orderId: string) => {
    setDraggedOrder(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropZone: 'cancel' | 'modify') => {
    e.preventDefault();
    
    if (!draggedOrder) return;

    if (dropZone === 'cancel') {
      const orderToCancel = pendingOrders.find(o => o.id === draggedOrder);
      
      if (orderToCancel) {
        setPendingOrders(current => 
          current.filter(order => order.id !== draggedOrder)
        );
        
        setOrders(prev => {
          const orderExists = prev.some(existingOrder => existingOrder.id === draggedOrder);
          if (orderExists) return prev;
          
          const cancelledOrder = {
            ...orderToCancel,
            status: 'cancelled' as const
          };
          
          return [cancelledOrder, ...prev.slice(0, 4)];
        });
        
        setLatestMessage("Order successfully cancelled by user");
        setShowOrderStatus(true);
        setTimeout(() => setShowOrderStatus(false), 3000);
      }
    }
    
    setDraggedOrder(null);
  };

  const getOrderStatusDisplay = (order: Order) => {
    switch (order.status) {
      case 'executed':
        return { text: '✅ EXECUTED', color: 'text-green-600' };
      case 'reverted':
        return { text: '↩️ REVERTED', color: 'text-orange-600' };
      case 'permanent':
        return { text: '🔒 PERMANENT', color: 'text-blue-600' };
      case 'cancelled':
        return { text: '🚫 CANCELLED', color: 'text-red-600' };
      default:
        return { text: '⏳ PENDING', color: 'text-amber-600' };
    }
  };

  const getOrderBorderColor = (order: Order) => {
    switch (order.status) {
      case 'executed':
        return 'border-green-400';
      case 'reverted':
        return 'border-orange-400';
      case 'permanent':
        return 'border-blue-400';
      case 'cancelled':
        return 'border-red-400';
      default:
        return 'border-gray-400';
    }
  };

  const getSoftFinalityStats = () => {
    const softOrders = orders.filter(o => o.finalityType === 'soft');
    const softPermanent = softOrders.filter(o => o.status === 'permanent').length;
    const softReverted = softOrders.filter(o => o.status === 'reverted').length;
    const softTotal = softPermanent + softReverted;
    
    return {
      total: softTotal,
      permanent: softPermanent,
      reverted: softReverted,
      permanentRate: softTotal > 0 ? Math.round((softPermanent / softTotal) * 100) : 0,
      revertRate: softTotal > 0 ? Math.round((softReverted / softTotal) * 100) : 0
    };
  };

  const softStats = getSoftFinalityStats();

  return (
    <div className={`min-h-screen p-6 transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Tour Component */}
      <Joyride
        key={tourKey}
        steps={tourSteps}
        run={runTour}
        callback={handleTourCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        styles={{
          options: {
            arrowColor: "#ec4899",
            backgroundColor: isDarkMode ? "#1f2937" : "#ec4899",
            overlayColor: "rgba(236, 72, 153, 0.3)",
            primaryColor: "#ec4899",
            textColor: isDarkMode ? "#e5e7eb" : "#fff",
            width: 320,
            zIndex: 1000,
          },
          spotlight: {
            backgroundColor: "transparent",
            border: "2px solid #ec4899",
          },
        }}
        locale={{
          back: "← Back",
          close: "✕",
          last: "Finish Tour",
          next: "Next →",
          skip: "Skip Tour",
        }}
      />

      {/* Header */}
      <div className={`border rounded-lg p-4 mb-6 tour-welcome transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-pink-900/20 to-rose-900/20 border-pink-700' 
          : 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200'
      }`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              CryptoExchange Pro
            </h1>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              Professional Trading Platform - Interactive Finality Demo
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-pink-400">
                Current Selection: <strong>{selectedFinalityType === 'hard' ? 'Hard Finality (100% Permanent)' : 'Soft Finality (50% Permanent, 50% Revertible)'}</strong>
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Choose your preferred finality type before placing orders
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className={`tour-theme-toggle p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <motion.div
                initial={false}
                animate={{ rotate: isDarkMode ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </motion.div>
            </Button>
            {/* Help Button */}
            <Button
              onClick={startTour}
              className="tour-help-button bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              🆘 Start Tour
            </Button>
            <div className={`text-right rounded-lg p-3 border tour-balance transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-gray-800 border-pink-700' 
                : 'bg-white border-pink-200'
            }`}>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Total Balance
              </p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                ${balance.toLocaleString()}
              </p>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Soft Revert Rate: {Math.round(softFinalityRevertChance * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2">
          <Card className={`transition-colors duration-300 ${
            isDarkMode ? 'border-pink-700 bg-gray-800' : 'border-pink-200'
          }`}>
            <CardHeader className={`border-b transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-pink-900/20 border-pink-700' 
                : 'bg-pink-50 border-pink-200'
            }`}>
              <CardTitle className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                SOL/USDT
              </CardTitle>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-green-600">${currentPrice}</span>
                <span className="text-green-600 text-sm">+2.45%</span>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div ref={chartRef} className="w-full" />
            </CardContent>
          </Card>

          {/* Order Management Zone */}
          <Card className={`mt-6 transition-colors duration-300 ${
            isDarkMode ? 'border-pink-700 bg-gray-800' : 'border-pink-200'
          }`}>
            <CardHeader className={`border-b transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-pink-900/20 border-pink-700' 
                : 'bg-pink-50 border-pink-200'
            }`}>
              <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Order Management
              </CardTitle>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Drag pending orders to cancel them
              </p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Pending Orders */}
                <div className="space-y-2 tour-pending-orders">
                  <h3 className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Pending Orders ({pendingOrders.length})
                  </h3>
                  <div className={`min-h-32 border-2 border-dashed rounded-lg p-2 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-yellow-900/20 border-yellow-700' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    {pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={() => handleDragStart(order.id)}
                        className={`border rounded p-2 mb-2 cursor-move hover:shadow-md transition-all duration-300 ${
                          isDarkMode 
                            ? 'bg-gray-700 border-yellow-600' 
                            : 'bg-white border-yellow-300'
                        }`}
                      >
                        <div className="flex justify-between text-xs">
                          <span className={`font-bold ${order.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                            {order.type.toUpperCase()} {order.orderType}
                          </span>
                          <span className="text-amber-600">⏳ PENDING</span>
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {order.quantity} SOL @ ${order.price?.toFixed(2)}
                        </div>
                        <div className="text-xs">
                          <span className={order.finalityType === 'soft' ? 'text-orange-600' : 'text-blue-600'}>
                            {order.finalityType === 'soft' ? '🔄 Soft' : '🔒 Hard'} Finality
                          </span>
                        </div>
                      </div>
                    ))}
                    {pendingOrders.length === 0 && (
                      <p className={`text-center py-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        No pending orders
                      </p>
                    )}
                  </div>
                </div>

                {/* Cancel Zone */}
                <div className="space-y-2">
                  <h3 className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Cancel Orders
                  </h3>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'cancel')}
                    className={`min-h-32 border-2 border-dashed rounded-lg p-2 flex items-center justify-center transition-colors duration-300 ${
                      isDarkMode 
                        ? 'bg-red-900/20 border-red-700' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="text-2xl mb-2">🗑️</div>
                      <p className="text-sm">Drop orders here to cancel</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Finality Statistics */}
          <Card className={`mt-6 tour-statistics transition-colors duration-300 ${
            isDarkMode ? 'border-pink-700 bg-gray-800' : 'border-pink-200'
          }`}>
            <CardHeader className={`border-b transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-pink-900/20 border-pink-700' 
                : 'bg-pink-50 border-pink-200'
            }`}>
              <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Finality Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`border rounded-lg p-3 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-blue-900/20 border-blue-700' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="text-2xl font-bold text-blue-600">
                    {orders.filter(o => o.status === 'permanent').length}
                  </div>
                  <div className="text-sm text-blue-600">Total Permanent</div>
                </div>
                <div className={`border rounded-lg p-3 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-orange-900/20 border-orange-700' 
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="text-2xl font-bold text-orange-600">
                    {orders.filter(o => o.status === 'reverted').length}
                  </div>
                  <div className="text-sm text-orange-600">Total Reverted</div>
                </div>
              </div>
              
              <div className={`border rounded-lg p-3 transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Soft Finality Results
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className={`font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {softStats.total}
                    </div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      Total Soft
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{softStats.permanentRate}%</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      Permanent Rate
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-orange-600">{softStats.revertRate}%</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      Revert Rate
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trading Panel */}
        <div className="space-y-4">
          <Card className={`transition-colors duration-300 ${
            isDarkMode ? 'border-pink-700 bg-gray-800' : 'border-pink-200'
          }`}>
            <CardHeader className={`border-b transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-pink-900/20 border-pink-700' 
                : 'bg-pink-50 border-pink-200'
            }`}>
              <CardTitle className={isDarkMode ? 'text-white' : 'text-black'}>
                Trading Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* Finality Type Selection */}
              <div className={`mb-6 p-4 border rounded-lg tour-finality-selection transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-700' 
                  : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
              }`}>
                <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Choose Finality Type
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="finalityType"
                      value="soft"
                      checked={selectedFinalityType === 'soft'}
                      onChange={(e) => setSelectedFinalityType(e.target.value as 'soft' | 'hard')}
                      className="text-orange-600 focus:ring-orange-400"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-orange-700">🔄 Soft Finality</div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        50% chance of reversion
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="finalityType"
                      value="hard"
                      checked={selectedFinalityType === 'hard'}
                      onChange={(e) => setSelectedFinalityType(e.target.value as 'soft' | 'hard')}
                      className="text-blue-600 focus:ring-blue-400"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-700">🔒 Hard Finality</div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        100% permanent
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Trading Tabs */}
              <div className="w-full mb-4 tour-trading-tabs">
                <div className={`flex border-b ${
                  isDarkMode ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  <button
                    onClick={() => setActiveTab('market')}
                    className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors duration-300 ${
                      activeTab === 'market'
                        ? 'border-pink-500 text-pink-400 bg-pink-900/20'
                        : isDarkMode 
                          ? 'border-transparent text-gray-400 hover:text-gray-300'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setActiveTab('limit')}
                    className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors duration-300 ${
                      activeTab === 'limit'
                        ? 'border-pink-500 text-pink-400 bg-pink-900/20'
                        : isDarkMode 
                          ? 'border-transparent text-gray-400 hover:text-gray-300'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Limit
                  </button>
                </div>
              </div>
              
              {activeTab === 'market' && (
                <div className="space-y-4">
                  <div className="tour-quantity-input">
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Quantity (SOL)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 tour-trade-buttons">
                    <Button 
                      onClick={() => handleTrade('buy', 'market')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Buy Market
                    </Button>
                    <Button 
                      onClick={() => handleTrade('sell', 'market')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Sell Market
                    </Button>
                  </div>
                </div>
              )}
              
              {activeTab === 'limit' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Price (USDT)
                    </label>
                    <input
                      type="number"
                      placeholder="85.00"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="tour-quantity-input">
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Quantity (SOL)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 tour-trade-buttons">
                    <Button 
                      onClick={() => handleTrade('buy', 'limit')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Buy Limit
                    </Button>
                    <Button 
                      onClick={() => handleTrade('sell', 'limit')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Sell Limit
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className={`tour-order-history transition-colors duration-300 ${
            isDarkMode ? 'border-pink-700 bg-gray-800' : 'border-pink-200'
          }`}>
            <CardHeader className={`border-b transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-pink-900/20 border-pink-700' 
                : 'bg-pink-50 border-pink-200'
            }`}>
              <CardTitle className={`text-sm ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orders.length === 0 ? (
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No order history
                  </p>
                ) : (
                  orders.map((order) => {
                    const statusDisplay = getOrderStatusDisplay(order);
                    const borderColor = getOrderBorderColor(order);
                    
                    return (
                      <div key={order.id} className={`text-xs p-2 rounded border-l-4 ${borderColor} transition-colors duration-300 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                      }`}>
                        <div className="flex justify-between">
                          <span className={order.type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                            {order.type.toUpperCase()} {order.orderType}
                          </span>
                          <span className={`font-bold ${statusDisplay.color}`}>
                            {statusDisplay.text}
                          </span>
                        </div>
                        <div className={`mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {order.quantity} SOL @ ${order.price?.toFixed(2)}
                        </div>
                        {order.finalityType && (
                          <div className="text-xs italic">
                            <span className={order.finalityType === 'soft' ? 'text-orange-600' : 'text-blue-600'}>
                              {order.finalityType === 'soft' ? '🔄 Soft Finality' : '🔒 Hard Finality'}
                            </span>
                            {order.originalBalance && order.newBalance && (
                              <span className={`ml-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                ${order.originalBalance.toLocaleString()} → ${order.newBalance.toLocaleString()}
                                {order.status === 'reverted' && ' → Reverted'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Status Notification */}
      <AnimatePresence>
        {showOrderStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className={`max-w-md border border-orange-400 rounded-lg shadow-lg transition-colors duration-300 ${
              isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50'
            }`}>
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-orange-600 text-xl">⚡</div>
                  <div className="flex-1">
                    <p className={`font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-800'}`}>
                      Finality Update
                    </p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                      {latestMessage}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export the component with client-side only rendering
export default function SoftHardFinality() {
  return <SoftHardFinalityComponent />;
}
