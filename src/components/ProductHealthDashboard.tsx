import React from 'react';
import { motion } from 'motion/react';
import { 
  Package, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  BarChart3 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { cn } from '../lib/utils';

interface ProductHealthDashboardProps {
  products: any[];
  currentTxs: any[];
  theme: string;
  currency: string;
  formatCurrency: (amount: number, curr?: string) => string;
  limitLetters: (text: string, limit?: number) => string;
}

export const ProductHealthDashboard: React.FC<ProductHealthDashboardProps> = ({
  products,
  currentTxs,
  theme,
  currency,
  formatCurrency,
  limitLetters,
}) => {
  const productVelocityStats = React.useMemo(() => {
    const salesMap: Record<string, { id: string; name: string; barcode: string; category: string; quantitySold: number; revenue: number; currentStock: number; price: number }> = {};

    // Seed all catalog products
    products.forEach(p => {
      const key = (p.id || p.name).toLowerCase();
      salesMap[key] = {
        id: p.id || '',
        name: p.name,
        barcode: p.barcode || p.sku || (p.id ? p.id.slice(0, 8).toUpperCase() : 'N/A'),
        category: p.category || 'General',
        quantitySold: 0,
        revenue: 0,
        currentStock: p.stockLevel || 0,
        price: p.price || 0,
      };
    });

    // Accumulate sales from currentTxs
    currentTxs.forEach(tx => {
      (tx.items || []).forEach((item: any) => {
        const matchKey = (item.id || item.name || '').toLowerCase();
        let targetKey = matchKey;
        if (!salesMap[targetKey]) {
          const foundKey = Object.keys(salesMap).find(k => salesMap[k].name.toLowerCase() === (item.name || '').toLowerCase());
          if (foundKey) targetKey = foundKey;
        }

        if (salesMap[targetKey]) {
          salesMap[targetKey].quantitySold += (item.quantity || 1);
          salesMap[targetKey].revenue += (item.price || 0) * (item.quantity || 1);
        } else {
          salesMap[targetKey] = {
            id: item.id || targetKey,
            name: item.name || 'Unknown Item',
            barcode: item.barcode || item.sku || 'N/A',
            category: 'General',
            quantitySold: item.quantity || 1,
            revenue: (item.price || 0) * (item.quantity || 1),
            currentStock: 0,
            price: item.price || 0,
          };
        }
      });
    });

    return Object.values(salesMap);
  }, [products, currentTxs]);

  const fastestMovingProducts = React.useMemo(() => {
    return [...productVelocityStats]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 6)
      .map(p => ({
        ...p,
        displayName: limitLetters(p.name, 16),
      }));
  }, [productVelocityStats, limitLetters]);

  const slowMovingProducts = React.useMemo(() => {
    return [...productVelocityStats]
      .sort((a, b) => {
        if (a.quantitySold !== b.quantitySold) return a.quantitySold - b.quantitySold;
        return b.currentStock - a.currentStock;
      })
      .slice(0, 6)
      .map(p => ({
        ...p,
        displayName: limitLetters(p.name, 16),
      }));
  }, [productVelocityStats, limitLetters]);

  const productHealthStats = React.useMemo(() => {
    const totalValuation = products.reduce((acc, p) => acc + (p.stockLevel || 0) * (p.price || 0), 0);
    const healthyCount = products.filter(p => (p.stockLevel || 0) > 5).length;
    const lowStockCount = products.filter(p => (p.stockLevel || 0) > 0 && (p.stockLevel || 0) <= 5).length;
    const outOfStockCount = products.filter(p => (p.stockLevel || 0) === 0).length;
    const totalCount = products.length;
    const healthyRatio = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

    return {
      totalValuation,
      healthyCount,
      lowStockCount,
      outOfStockCount,
      totalCount,
      healthyRatio,
    };
  }, [products]);

  return (
    <div 
      className="space-y-8"
    >
      {/* BLOCK: Products Health Live Metrics Summary Grid - Key product counts and valuations */}
      <div className="product-health-metrics live-metrics-container font-presale font-live-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { 
            label: 'Catalog Items', 
            value: `${productHealthStats.totalCount} Products`, 
            icon: Package,
            modifier: 'catalog',
            iconColorClass: theme === 'dark' ? "text-cyan-300 bg-cyan-500/10 border border-cyan-500/20" : "text-blue-900 bg-blue-50 border border-blue-200"
          },
          { 
            label: 'Stock Valuation', 
            value: formatCurrency(productHealthStats.totalValuation, currency), 
            icon: DollarSign,
            modifier: 'valuation',
            iconColorClass: theme === 'dark' ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20" : "text-[#062A95] bg-[#062A95]/10 border border-blue-200"
          },
          { 
            label: 'Healthy Stock (>5)', 
            value: `${productHealthStats.healthyCount} (${productHealthStats.healthyRatio}%)`, 
            icon: CheckCircle2,
            modifier: 'healthy',
            iconColorClass: "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20",
            valueColorClass: "text-emerald-500"
          },
          { 
            label: 'Low Stock (1-5)', 
            value: `${productHealthStats.lowStockCount} Items`, 
            icon: AlertTriangle,
            modifier: 'low-stock',
            iconColorClass: "text-amber-500 bg-amber-500/10 border border-amber-500/20",
            valueColorClass: "text-amber-500"
          },
          { 
            label: 'Out of Stock (0)', 
            value: `${productHealthStats.outOfStockCount} Items`, 
            icon: AlertCircle,
            modifier: 'out-of-stock',
            iconColorClass: "text-red-500 bg-red-500/10 border border-red-500/20",
            valueColorClass: productHealthStats.outOfStockCount > 0 ? "text-red-500 font-black animate-pulse" : "text-red-500"
          },
        ].map((stat, i) => (
          <div 
            key={i} 
            className={cn(
              "product-health-card live-metrics-card presale-stream-card border p-4 sm:p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-md font-presale",
              `product-health-card--${stat.modifier}`,
              theme === 'dark' 
                ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
            )}
          >
            <div className={cn(
              "product-health-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center shadow-xs",
              stat.iconColorClass
            )}>
              <stat.icon size={20} />
            </div>
            <div className="product-health-card__info min-w-0 flex-1 font-presale">
              <p className={cn("product-health-card__label text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{stat.label}</p>
              <p className={cn(
                "product-health-card__value text-xl sm:text-2xl font-bold font-mono tracking-wide mt-0.5 truncate",
                stat.valueColorClass || (theme === "dark" ? "text-white" : "text-slate-900")
              )}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* BLOCK: Fastest Moving Products vs Slow Moving Products Bar Chart Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Fastest Moving Products Bar Graph */}
        <div className={cn(
          "product-velocity-card border rounded-2xl p-6 md:p-8 transition-colors shadow-hard flex flex-col justify-between",
          theme === 'dark' ? "product-velocity-card--dark bg-dark-surface border-white/35" : "product-velocity-card--light bg-light-surface border-slate-400"
        )}>
          <div>
            <div className="product-velocity-card__header flex items-center justify-between mb-6 border-b border-solid border-inherit pb-4 flex-wrap gap-2">
              <h3 className="product-velocity-card__title font-black uppercase tracking-widest text-sm text-brand-primary flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-500" /> Fastest Moving Products
              </h3>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-wider rounded border border-emerald-500/20">
                High Velocity
              </span>
            </div>

            {/* Recharts Bar Chart - Fastest Moving Products */}
            <div className="product-velocity-card__chart-container h-[260px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fastestMovingProducts} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                  <XAxis 
                    dataKey="displayName" 
                    stroke="#666" 
                    fontSize={9} 
                    axisLine={false} 
                    tickLine={false} 
                    fontWeight="bold" 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} fontWeight="bold" />
                  <Tooltip 
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className={cn(
                            "p-3 rounded-xl border shadow-xl text-xs font-presale",
                            theme === 'dark' ? "bg-dark-surface/95 border-white/20 text-white" : "bg-white/95 border-slate-300 text-black"
                          )}>
                            <p className="font-black uppercase tracking-wider text-brand-primary mb-1">{data.name}</p>
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <p className="text-emerald-500 font-bold">Units Sold: {data.quantitySold}</p>
                              <p className="opacity-70">Revenue: {formatCurrency(data.revenue, currency)}</p>
                              <p className="opacity-70">Current Stock: {data.currentStock} units</p>
                              <p className="opacity-50 text-[9px] uppercase font-presale mt-1">Cat: {data.category}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="quantitySold" radius={[6, 6, 0, 0]}>
                    {fastestMovingProducts.map((_, index) => (
                      <Cell key={`cell-fast-${index}`} fill={theme === 'dark' ? '#00E5FF' : '#062A95'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fastest Moving Item Leaderboard Table */}
          <div className="space-y-2 mt-2 pt-4 border-t border-inherit">
            <span className="text-[10px] font-black uppercase tracking-widest text-dark-muted block mb-2">
              Top Product Leaders
            </span>
            {fastestMovingProducts.slice(0, 4).map((prod, idx) => (
              <div 
                key={prod.id || idx}
                className={cn(
                  "p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors",
                  theme === 'dark' ? "bg-black/20 border-white/10" : "bg-white border-slate-300"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center font-mono font-black text-[10px] shrink-0 border",
                    idx === 0 ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" :
                    idx === 1 ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30" :
                    "bg-black/10 dark:bg-white/10 text-dark-muted border-transparent"
                  )}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold uppercase text-[11px] truncate">{prod.name}</p>
                    <p className="text-[9px] font-mono opacity-50 uppercase">{prod.category} • {formatCurrency(prod.price, currency)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-black text-emerald-500 text-xs">{prod.quantitySold} Sold</p>
                  <p className="font-mono text-[9px] opacity-60">{formatCurrency(prod.revenue, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Slow Moving & Stagnant Inventory Bar Graph */}
        <div className={cn(
          "product-velocity-card border rounded-2xl p-6 md:p-8 transition-colors shadow-hard flex flex-col justify-between",
          theme === 'dark' ? "product-velocity-card--dark bg-dark-surface border-white/35" : "product-velocity-card--light bg-light-surface border-slate-400"
        )}>
          <div>
            <div className="product-velocity-card__header flex items-center justify-between mb-6 border-b border-solid border-inherit pb-4 flex-wrap gap-2">
              <h3 className="product-velocity-card__title font-black uppercase tracking-widest text-sm text-amber-500 flex items-center gap-2">
                <TrendingDown size={18} className="text-amber-500" /> Slow Moving & Stagnant Stock
              </h3>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-wider rounded border border-amber-500/20">
                Low Velocity
              </span>
            </div>

            {/* Recharts Bar Chart - Slow Moving Products */}
            <div className="product-velocity-card__chart-container h-[260px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slowMovingProducts} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                  <XAxis 
                    dataKey="displayName" 
                    stroke="#666" 
                    fontSize={9} 
                    axisLine={false} 
                    tickLine={false} 
                    fontWeight="bold" 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} fontWeight="bold" />
                  <Tooltip 
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className={cn(
                            "p-3 rounded-xl border shadow-xl text-xs font-presale",
                            theme === 'dark' ? "bg-dark-surface/95 border-white/20 text-white" : "bg-white/95 border-slate-300 text-black"
                          )}>
                            <p className="font-black uppercase tracking-wider text-amber-500 mb-1">{data.name}</p>
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <p className="text-amber-500 font-bold">Units Sold: {data.quantitySold}</p>
                              <p className="opacity-70">Holding Stock: {data.currentStock} units</p>
                              <p className="opacity-70">Valuation Tied Up: {formatCurrency(data.currentStock * data.price, currency)}</p>
                              <p className="opacity-50 text-[9px] uppercase font-presale mt-1">Cat: {data.category}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="quantitySold" radius={[6, 6, 0, 0]}>
                    {slowMovingProducts.map((_, index) => (
                      <Cell key={`cell-slow-${index}`} fill={theme === 'dark' ? '#F59E0B' : '#D97706'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stagnant Stock List Preview */}
          <div className="space-y-2 mt-2 pt-4 border-t border-inherit">
            <span className="text-[10px] font-black uppercase tracking-widest text-dark-muted block mb-2">
              Stagnant / Holding Inventory
            </span>
            {slowMovingProducts.slice(0, 4).map((prod, idx) => {
              const tiedUpCapital = prod.currentStock * prod.price;
              return (
                <div 
                  key={prod.id || idx}
                  className={cn(
                    "p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors",
                    theme === 'dark' ? "bg-black/20 border-white/10" : "bg-white border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-mono font-black text-[10px] shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold uppercase text-[11px] truncate">{prod.name}</p>
                      <p className="text-[9px] font-mono opacity-50 uppercase">{prod.category} • {prod.currentStock} Stocked</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-amber-500 text-xs">{prod.quantitySold} Sold</p>
                    <p className="font-mono text-[9px] opacity-60">Capital: {formatCurrency(tiedUpCapital, currency)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BLOCK: Stock Health Equilibrium Breakdown Card */}
      <div className={cn(
        "product-equilibrium-card border rounded-2xl p-6 md:p-8 transition-colors shadow-hard",
        theme === 'dark' ? "product-equilibrium-card--dark bg-dark-surface border-white/35" : "product-equilibrium-card--light bg-light-surface border-slate-400"
      )}>
        <div className="product-equilibrium-card__header flex items-center justify-between mb-6 border-b border-solid border-inherit pb-4 flex-wrap gap-2">
          <h3 className="product-equilibrium-card__title font-black uppercase tracking-widest text-sm text-brand-primary flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-primary" /> Inventory Health Breakdown
          </h3>
          <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase tracking-wider rounded border border-brand-primary/20">
            Live Health
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Optimal Stock Level Card */}
          <div className={cn(
            "p-5 rounded-xl border flex flex-col justify-between gap-3",
            theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-900"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest">Optimal Stock (&gt;5 Units)</span>
              <CheckCircle2 size={18} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-3xl font-black font-mono tracking-tight">{productHealthStats.healthyCount}</p>
              <p className="text-[10px] font-mono opacity-70 uppercase tracking-wider mt-1">{productHealthStats.healthyRatio}% of Total Catalog</p>
            </div>
            <div className="w-full bg-emerald-500/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${productHealthStats.healthyRatio}%` }} />
            </div>
          </div>

          {/* Low Stock Threshold Card */}
          <div className={cn(
            "p-5 rounded-xl border flex flex-col justify-between gap-3",
            theme === 'dark' ? "bg-amber-500/5 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-900"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest">Low Stock Alert (1-5 Units)</span>
              <AlertTriangle size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-3xl font-black font-mono tracking-tight">{productHealthStats.lowStockCount}</p>
              <p className="text-[10px] font-mono opacity-70 uppercase tracking-wider mt-1">Requires Reorder Planning</p>
            </div>
            <div className="w-full bg-amber-500/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${productHealthStats.totalCount > 0 ? Math.round((productHealthStats.lowStockCount / productHealthStats.totalCount) * 100) : 0}%` }} />
            </div>
          </div>

          {/* Out of Stock Card */}
          <div className={cn(
            "p-5 rounded-xl border flex flex-col justify-between gap-3",
            theme === 'dark' ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-900"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest">Depleted / Out of Stock (0)</span>
              <AlertCircle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-3xl font-black font-mono tracking-tight">{productHealthStats.outOfStockCount}</p>
              <p className="text-[10px] font-mono opacity-70 uppercase tracking-wider mt-1">Loss of Revenue Potential</p>
            </div>
            <div className="w-full bg-red-500/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full rounded-full" style={{ width: `${productHealthStats.totalCount > 0 ? Math.round((productHealthStats.outOfStockCount / productHealthStats.totalCount) * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
