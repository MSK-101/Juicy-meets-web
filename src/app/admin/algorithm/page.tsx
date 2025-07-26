"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faRandom,
  faRepeat,
  faCog,
  faInfoCircle,
  faPlus,
  faTrash,
  faEdit
} from "@fortawesome/free-solid-svg-icons";

interface Sequence {
  id: string;
  name: string;
  videoCount: number;
  isActive: boolean;
  order: number;
}

interface Pool {
  id: string;
  name: string;
  sequences: Sequence[];
}

export default function Algorithm() {
  const [selectedPool, setSelectedPool] = useState("A");
  const [pools, setPools] = useState<Pool[]>([
    {
      id: "A",
      name: "Pool A",
      sequences: [
        { id: "A1", name: "Sequence 1", videoCount: 5, isActive: true, order: 1 },
        { id: "A2", name: "Sequence 2", videoCount: 3, isActive: true, order: 2 },
        { id: "A3", name: "Sequence 3", videoCount: 5, isActive: false, order: 3 },
        { id: "A4", name: "Sequence 4", videoCount: 5, isActive: true, order: 4 },
        { id: "A5", name: "Sequence 5", videoCount: 5, isActive: true, order: 5 },
        { id: "A6", name: "Sequence 6", videoCount: 5, isActive: true, order: 6 },
        { id: "A7", name: "Sequence 7", videoCount: 5, isActive: true, order: 7 },
        { id: "A8", name: "Sequence 8", videoCount: 5, isActive: true, order: 8 },
        { id: "A9", name: "Sequence 9", videoCount: 5, isActive: true, order: 9 },
        { id: "A10", name: "Sequence 10", videoCount: 5, isActive: true, order: 10 },
      ]
    },
    {
      id: "B",
      name: "Pool B",
      sequences: [
        { id: "B1", name: "Sequence 1", videoCount: 4, isActive: true, order: 1 },
        { id: "B2", name: "Sequence 2", videoCount: 6, isActive: true, order: 2 },
        { id: "B3", name: "Sequence 3", videoCount: 3, isActive: false, order: 3 },
        { id: "B4", name: "Sequence 4", videoCount: 5, isActive: true, order: 4 },
        { id: "B5", name: "Sequence 5", videoCount: 4, isActive: true, order: 5 },
        { id: "B6", name: "Sequence 6", videoCount: 6, isActive: true, order: 6 },
        { id: "B7", name: "Sequence 7", videoCount: 3, isActive: true, order: 7 },
        { id: "B8", name: "Sequence 8", videoCount: 5, isActive: true, order: 8 },
        { id: "B9", name: "Sequence 9", videoCount: 4, isActive: true, order: 9 },
        { id: "B10", name: "Sequence 10", videoCount: 5, isActive: true, order: 10 },
      ]
    },
    {
      id: "C",
      name: "Pool C",
      sequences: [
        { id: "C1", name: "Sequence 1", videoCount: 5, isActive: true, order: 1 },
        { id: "C2", name: "Sequence 2", videoCount: 4, isActive: true, order: 2 },
        { id: "C3", name: "Sequence 3", videoCount: 6, isActive: false, order: 3 },
        { id: "C4", name: "Sequence 4", videoCount: 3, isActive: true, order: 4 },
        { id: "C5", name: "Sequence 5", videoCount: 5, isActive: true, order: 5 },
        { id: "C6", name: "Sequence 6", videoCount: 4, isActive: true, order: 6 },
        { id: "C7", name: "Sequence 7", videoCount: 6, isActive: true, order: 7 },
        { id: "C8", name: "Sequence 8", videoCount: 3, isActive: true, order: 8 },
        { id: "C9", name: "Sequence 9", videoCount: 5, isActive: true, order: 9 },
        { id: "C10", name: "Sequence 10", videoCount: 4, isActive: true, order: 10 },
      ]
    }
  ]);

  const [algorithmBehavior, setAlgorithmBehavior] = useState<"random" | "exact">("exact");
  const [selectedSequencesForRandom, setSelectedSequencesForRandom] = useState<string[]>([]);

  const currentPool = pools.find(pool => pool.id === selectedPool);

  const handleSequenceToggle = (sequenceId: string) => {
    setPools(prevPools =>
      prevPools.map(pool =>
        pool.id === selectedPool
          ? {
              ...pool,
              sequences: pool.sequences.map(seq =>
                seq.id === sequenceId
                  ? { ...seq, isActive: !seq.isActive }
                  : seq
              )
            }
          : pool
      )
    );
  };

  const handleVideoCountChange = (sequenceId: string, newCount: number) => {
    setPools(prevPools =>
      prevPools.map(pool =>
        pool.id === selectedPool
          ? {
              ...pool,
              sequences: pool.sequences.map(seq =>
                seq.id === sequenceId
                  ? { ...seq, videoCount: newCount }
                  : seq
              )
            }
          : pool
      )
    );
  };

    // TODO: Implement drag and drop reordering functionality
  // const handleSequenceReorder = (fromIndex: number, toIndex: number) => {
  //   if (!currentPool) return;

  //   const newSequences = [...currentPool.sequences];
  //   const [movedSequence] = newSequences.splice(fromIndex, 1);
  //   newSequences.splice(toIndex, 0, movedSequence);

  //   // Update order numbers
  //   const updatedSequences = newSequences.map((seq, index) => ({
  //     ...seq,
  //     order: index + 1
  //   }));

  //   setPools(prevPools =>
  //     prevPools.map(pool =>
  //       pool.id === selectedPool
  //         ? { ...pool, sequences: updatedSequences }
  //         : pool
  //     )
  //   );
  // };

    const handleRandomSequenceToggle = (sequenceId: string) => {
    setSelectedSequencesForRandom(prev =>
      prev.includes(sequenceId)
        ? prev.filter(id => id !== sequenceId)
        : [...prev, sequenceId]
    );
  };

  const handleAddSequence = () => {
    if (!currentPool) return;

    const newSequenceNumber = currentPool.sequences.length + 1;
    const newSequence: Sequence = {
      id: `${selectedPool}${newSequenceNumber}`,
      name: `Sequence ${newSequenceNumber}`,
      videoCount: 5,
      isActive: true,
      order: newSequenceNumber
    };

    setPools(prevPools =>
      prevPools.map(pool =>
        pool.id === selectedPool
          ? {
              ...pool,
              sequences: [...pool.sequences, newSequence]
            }
          : pool
      )
    );
  };

  const handleEditSequence = (sequenceId: string) => {
    // TODO: Implement edit modal or inline editing
    console.log("Edit sequence:", sequenceId);
    alert("Edit functionality coming soon!");
  };

  const handleDeleteSequence = (sequenceId: string) => {
    if (!currentPool) return;

    if (currentPool.sequences.length <= 1) {
      alert("Cannot delete the last sequence. At least one sequence must remain.");
      return;
    }

    if (confirm("Are you sure you want to delete this sequence?")) {
      setPools(prevPools =>
        prevPools.map(pool =>
          pool.id === selectedPool
            ? {
                ...pool,
                sequences: pool.sequences
                  .filter(seq => seq.id !== sequenceId)
                  .map((seq, index) => ({ ...seq, order: index + 1 }))
              }
            : pool
        )
      );
    }
  };

  return (
    <div className="space-y-8 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-poppins">Algorithm</h1>
          <p className="text-gray-600 font-poppins mt-1">Manage video sequences and algorithm behavior</p>
        </div>
      </div>

      {/* Pool Selection Tabs */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FontAwesomeIcon icon={faCog} className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Pool Configuration</h2>
            <p className="text-gray-600 font-poppins">Select and manage video pools</p>
          </div>
        </div>

        {/* Pool Tabs */}
        <div className="flex space-x-2 mb-8">
          {pools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => setSelectedPool(pool.id)}
              className={`px-6 py-3 rounded-xl font-semibold font-poppins transition-all duration-200 ${
                selectedPool === pool.id
                  ? "bg-gray-200 text-gray-900 shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {pool.name}
            </button>
          ))}
        </div>

                {/* Sequences List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 font-poppins">
              Sequences for {currentPool?.name}
            </h3>
            <button
              onClick={() => handleAddSequence()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold font-poppins hover:bg-purple-700 transition-all duration-200 flex items-center space-x-2"
            >
              <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
              <span>Add Sequence</span>
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {currentPool?.sequences.map((sequence, index) => (
              <div
                key={sequence.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-all duration-200"
              >
                {/* Drag Handle and Order */}
                <div className="flex items-center space-x-4">
                  <div className="cursor-move text-gray-400 hover:text-gray-600">
                    <FontAwesomeIcon icon={faGripVertical} className="w-4 h-4" />
                  </div>

                  {/* Order Number */}
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-purple-600 font-poppins">
                      {index + 1}
                    </span>
                  </div>

                  {/* Sequence Info */}
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-gray-900 font-poppins">
                      {sequence.name}
                    </span>
                    <span className="text-sm text-gray-600 font-poppins">
                      {sequence.videoCount.toString().padStart(2, '0')} Videos
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-4">
                  {/* Video Count Input */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 font-poppins">Videos:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={sequence.videoCount}
                      onChange={(e) => handleVideoCountChange(sequence.id, parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded-lg text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 placeholder-gray-500"
                      placeholder="5"
                    />
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 font-poppins">Active:</span>
                    <button
                      onClick={() => handleSequenceToggle(sequence.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        sequence.isActive ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          sequence.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditSequence(sequence.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Sequence"
                    >
                      <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSequence(sequence.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Sequence"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Algorithm Behavior Settings */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <FontAwesomeIcon icon={faInfoCircle} className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-poppins">Algorithm Behavior</h2>
            <p className="text-gray-600 font-poppins">Configure what happens after 10 swipes</p>
          </div>
        </div>

        {/* Behavior Selection */}
        <div className="space-y-6">
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="algorithmBehavior"
                value="exact"
                checked={algorithmBehavior === "exact"}
                onChange={(e) => setAlgorithmBehavior(e.target.value as "exact")}
                className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faRepeat} className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900 font-poppins">Continue Exact Sequence Alignment</span>
              </div>
            </label>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="algorithmBehavior"
                value="random"
                checked={algorithmBehavior === "random"}
                onChange={(e) => setAlgorithmBehavior(e.target.value as "random")}
                className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faRandom} className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900 font-poppins">Randomize Algorithm</span>
              </div>
            </label>
          </div>

          {/* Random Sequence Selection */}
          {algorithmBehavior === "random" && (
            <div className="mt-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-semibold text-gray-900 font-poppins mb-4">
                Select Sequences for Random Mode
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currentPool?.sequences.map((sequence) => (
                  <label key={sequence.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSequencesForRandom.includes(sequence.id)}
                      onChange={() => handleRandomSequenceToggle(sequence.id)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-poppins text-gray-700">
                      {sequence.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold font-poppins hover:bg-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          Save Algorithm Settings
        </button>
      </div>
    </div>
  );
}
