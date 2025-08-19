import React, { useState, useEffect } from 'react';
import { CalendarIcon, InfoCircledIcon } from '@radix-ui/react-icons';

interface DaysFilterProps {
  value: number;
  onChange: (days: number) => void;
  disabled?: boolean;
}

const DaysFilter: React.FC<DaysFilterProps> = ({ 
  value, 
  onChange, 
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Sync input value with prop value when not focused
  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(value.toString());
    }
  }, [value, isInputFocused]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    const numValue = parseInt(inputValue);
    
    // Validate and constrain the input
    if (isNaN(numValue) || numValue < 1) {
      setInputValue('1');
      onChange(1);
    } else if (numValue > 365) {
      setInputValue('365');
      onChange(365);
    } else {
      onChange(numValue);
    }
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const getRecommendedRanges = () => [
    { label: '90 days (3 months)', value: 90, description: 'Standard quarterly view' },
    { label: '120 days (4 months)', value: 120, description: 'Extended quarterly view' },
    { label: '180 days (6 months)', value: 180, description: 'Semi-annual view' },
    { label: '365 days (1 year)', value: 365, description: 'Full annual view' },
  ];

  const getDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    return {
      start: startDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      end: endDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    };
  };

  const dateRange = getDateRange(value);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Add CSS for slider styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          .custom-slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          .custom-slider:focus {
            outline: none;
          }
          
          .custom-slider:focus::-webkit-slider-thumb {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
          }
        `
      }} />
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarIcon className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Data Import Time Range
        </h3>
        <div className="group relative">
          <InfoCircledIcon className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Select how many days back to fetch data from QuickBooks
          </div>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-700 font-medium">Data Range:</span>
          <span className="text-blue-800">
            {dateRange.start} → {dateRange.end}
          </span>
        </div>
        <div className="text-blue-600 text-xs mt-1">
          {value} days of historical data
        </div>
      </div>

      {/* Slider Control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Days (1-365)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="365"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setIsInputFocused(true)}
              onBlur={handleInputBlur}
              onKeyPress={handleInputKeyPress}
              disabled={disabled}
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
        </div>
        
        {/* Slider */}
        <div className="relative">
          <input
            type="range"
            min="1"
            max="365"
            value={value}
            onChange={handleSliderChange}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed custom-slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(value / 365) * 100}%, #e5e7eb ${(value / 365) * 100}%, #e5e7eb 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 day</span>
            <span>365 days</span>
          </div>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Quick Select:</h4>
        <div className="grid grid-cols-2 gap-2">
          {getRecommendedRanges().map((range) => (
            <button
              key={range.value}
              onClick={() => onChange(range.value)}
              disabled={disabled}
              className={`px-3 py-2 text-xs rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                value === range.value
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{range.label}</div>
              <div className="text-gray-500">{range.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Validation Message */}
      {(value < 30 || value > 365) && (
        <div className={`text-xs px-3 py-2 rounded ${
          value < 30 
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {value < 30 
            ? '⚠️ Less than 30 days may not provide enough data for accurate analysis'
            : '❌ Maximum 365 days (1 year) allowed'
          }
        </div>
      )}

    </div>
  );
};

export default DaysFilter;