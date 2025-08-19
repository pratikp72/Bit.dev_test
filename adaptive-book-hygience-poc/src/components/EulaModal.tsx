import React, { useEffect, useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import EulaContent from "./EulaContent";

interface EulaModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onDisagree: () => void;
  onClose: () => void;
}

const EulaModal: React.FC<EulaModalProps> = ({
  isOpen,
  onAgree,
  onDisagree,
  onClose,
}) => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const hasReachedBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setIsScrolledToBottom(hasReachedBottom);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            End User License Agreement (EULA)
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-6"
          onScroll={handleScroll}
        >
          <EulaContent />
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex items-center text-sm text-gray-600">
            {!isScrolledToBottom && (
              <span className="text-orange-600 font-medium">
                Please scroll to the bottom to continue
              </span>
            )}
            {isScrolledToBottom && (
              <span className="text-green-600 font-medium">
                By clicking "I Agree", you accept the terms of this agreement
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onDisagree}
              className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              I Disagree
            </button>
            <button
              onClick={onAgree}
              disabled={!isScrolledToBottom}
              className={`px-6 py-2 rounded-lg transition-colors ${
                isScrolledToBottom
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              I Agree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EulaModal;