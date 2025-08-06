export const formatNumber = (number: number): string => {
  if (number > 1000000) {
    return `${(number / 1000000).toFixed(1)}M`;
  } else if (number > 1000) {
    return `${(number / 1000).toFixed(1)}K`;
  } else {
    return number.toLocaleString();
  }
};
