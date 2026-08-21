const rsiMeanings = {
  overbought: 'it rose too fast, so a pullback (price drop) is likely',
  oversold: 'it fell too hard, so a bounce may be possible',
  healthy: 'a healthy middle range, neither too hot nor too cold',
  weak: 'momentum is weak, buyers are not pushing it up',
  neutral: 'no strong signal either way',
};

export function explainSignal(s) {
  const price = s.price != null ? `$${s.price.toFixed(4)}` : null;
  const buy = s.avgBuy != null ? `$${s.avgBuy.toFixed(4)}` : null;
  switch (s.type) {
    case 'CUT_LOSS':
      return (
        `Your average buy price for ${s.symbol} is ${buy}. The price is now ${price}, which is ` +
        `${Math.abs(s.gainPct).toFixed(1)}% BELOW what you paid — that is where the "72.8%" comes from (it is compared to your buy price, not to anything else).\n\n` +
        `"Cut loss" = sell it now on purpose, so the loss can't grow any bigger.\n\n` +
        `"Stop loss ${s.slPct}%" is the safety rule you set: if a coin drops ${s.slPct}% below your buy price, the app tells you to sell. ` +
        `This coin is already far past that line, so the app is telling you it's time to get out.`
      );
    case 'TAKE_PROFIT':
      return (
        `${s.symbol} is UP ${s.gainPct.toFixed(1)}% compared to your average buy price (${buy}).\n\n` +
        `"Take profit" = sell some or all now to lock in the gain, instead of hoping it goes higher (prices can also fall back).\n\n` +
        `"Target ${s.targetPct}%" is the profit level you chose as "good enough". Once reached, the app reminds you to take the money off the table.`
      );
    case 'BUY_CANDIDATE':
      return (
        `"Buy candidate" = the scanner thinks ${s.symbol} has real short-term momentum and could keep moving up.\n\n` +
        `"${s.mom4h.toFixed(1)}% in 4h" means the price rose that much in the last 4 hours.\n\n` +
        `"Volume ${s.volumeSpike.toFixed(1)}x" means it is being traded ${s.volumeSpike.toFixed(1)} times more than usual — big volume makes a price move more trustworthy (not just a fluke). ` +
        `It's a "look into it" signal, not a guarantee of profit.`
      );
    case 'RECOVERED':
      return (
        `${s.symbol} is back at your average buy price (${buy}).\n\n` +
        `"Break-even" = the price equals what you paid, so you are no longer losing money on it.\n\n` +
        `"Recovered" means it climbed back to that point after being in a loss. Now you decide: keep holding, or sell at break-even to free up your cash.`
      );
    case 'OVERBOUGHT': {
      const hold = s.avgBuy != null;
      const buy = hold ? `$${s.avgBuy.toFixed(4)}` : null;
      const price = s.price != null ? `$${s.price.toFixed(4)}` : null;
      let out =
        `"RSI" (Relative Strength Index) is a score from 0 to 100 that measures how fast and how hard a coin has been rising in recent hours.\n\n` +
        `${s.symbol} is at ${s.rsi.toFixed(0)}, which is high (above 70 = "overbought"). ` +
        `The price (now ${price}) climbed too fast, too quickly.\n\n` +
        `"Pullback likely" = the app expects a temporary price drop. It is a warning, not a guaranteed prediction — and not an automatic sell signal.\n\n`;
      if (hold) {
        out +=
          `You hold ${s.symbol} (average buy ${buy}). Overbought alone is not a reason to sell. ` +
          `Only act on a firm signal — e.g. a take-profit or trailing-stop alert — or if you are comfortably in profit and want to lock some in.`;
      } else {
        out +=
          `You do not hold ${s.symbol}. Overbought means the price is stretched — wait for the pullback before considering a buy.`;
      }
      return out;
    }
    case 'OVERSOLD': {
      const hold = s.avgBuy != null;
      const buy = hold ? `$${s.avgBuy.toFixed(4)}` : null;
      const price = s.price != null ? `$${s.price.toFixed(4)}` : null;
      let out =
        `"RSI" (Relative Strength Index) is a score from 0 to 100 that measures how fast a coin has fallen.\n\n` +
        `${s.symbol} is at ${s.rsi.toFixed(0)}, which is low (below 30 = "oversold"). ` +
        `The price (now ${price}) dropped sharply and quickly.\n\n` +
        `"Watch for a bounce" = the price might recover, but it is not guaranteed. Wait for signs of recovery before buying.\n\n`;
      if (hold) {
        out +=
          `You hold ${s.symbol} (average buy ${buy}). An oversold bounce could recover some of your loss, but do not buy more just because it is low — confirm the bounce first.`;
      } else {
        out +=
          `You do not hold ${s.symbol}. Only consider buying if the price shows real signs of turning up, not just because it looks cheap.`;
      }
      return out;
    }
    case 'TRAILING_STOP':
      return (
        `${s.symbol} reached a high of $${s.highPrice.toFixed(4)} and has now dropped ${s.trailPct}% from that high.\n\n` +
        `A "trailing stop" is a rule that follows the price upward and only sells if it falls ${s.trailPct}% from its highest point. ` +
        `It just triggered, so the app is telling you to sell now to lock in your gains before the drop continues.`
      );
    default:
      return null;
  }
}

export function explainVerdict(v) {
  const lines = [];
  lines.push(
    `"${v.stance}" is the scanner's overall opinion of ${v.symbol}. ${stanceMeaning(v.stance)}`
  );
  if (v.trend) {
    lines.push(
      `Trend "${v.trend}": compares the current price to its average over the past 26 hours. ` +
        `Uptrend = price above that average, downtrend = below it, sideways = roughly equal.`
    );
  }
  if (v.rsi != null) {
    lines.push(
      `RSI ${v.rsi.toFixed(0)} (${v.rsiLabel}): a 0-100 score of how fast the coin moved recently. Here ${rsiMeanings[v.rsiLabel] || 'no strong signal'}.`
    );
  }
  if (v.mom4h != null) {
    lines.push(`4h ${v.mom4h >= 0 ? '+' : ''}${v.mom4h.toFixed(1)}%: how much the price changed in the last 4 hours.`);
  }
  if (v.mom24h != null) {
    lines.push(`24h ${v.mom24h >= 0 ? '+' : ''}${v.mom24h.toFixed(1)}%: how much the price changed in the last 24 hours.`);
  }
  if (v.volumeSpike != null) {
    lines.push(
      `Volume ${v.volumeSpike.toFixed(1)}x: being traded ${v.volumeSpike.toFixed(1)} times more than usual. ` +
        `Big volume makes a price move more trustworthy than a quiet one.`
    );
  }
  if (v.support != null && v.resistance != null) {
    lines.push(
      `Support $${v.support.toFixed(4)} / Resistance $${v.resistance.toFixed(4)}: ` +
        `support is a price level where buying usually appears (a floor), resistance is a level where selling usually appears (a ceiling).`
    );
  }
  return lines.join('\n');
}

export function explainCandidate(c) {
  const lines = [];
  lines.push(
    `"Candidate of the day" = the strongest setup the scanner found right now. ${c.symbol} scored ${c.score} out of a possible 4 points.`
  );
  lines.push(`How the ${c.score} points were earned (momentum, volume and RSI each add or remove points):`);
  if (c.scoreDetail && c.scoreDetail.length) {
    for (const line of c.scoreDetail) lines.push(`• ${line}`);
  }
  lines.push(
    `What a score means: 2 = two or more positive signs (good), 3 = strong setup, 4 = every signal firing (best). ` +
      `Only coins scoring 2 or higher make the candidate list.`
  );
  if (c.held) {
    lines.push('You already hold this coin — the app is watching it for you.');
  } else {
    lines.push('You do not hold this coin — it is on the watch list because it is moving.');
  }
  if (c.verdict) {
    lines.push(`Current read: ${c.verdict}`);
  }
  return lines.join('\n');
}

function stanceMeaning(stance) {
  switch (stance) {
    case 'strong buy candidate':
      return 'Strong momentum plus volume — it may keep climbing, so it is worth investigating.';
    case 'slight bullish':
      return 'Mild positive momentum — a little in favour of going up.';
    case 'avoid / falling':
      return 'Weak or falling — risky right now, better to stay away.';
    case 'neutral':
      return 'No clear direction — waiting for a stronger signal.';
    default:
      return '';
  }
}
