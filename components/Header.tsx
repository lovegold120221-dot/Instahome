/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full p-4 text-center">
      <div className="flex items-center justify-center">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-800">
            Tropical House Customizer
          </h1>
      </div>
      <p className="mt-4 text-lg text-zinc-600 max-w-3xl mx-auto">
        Choose your preferences, select the number of variations, and let AI generate a gallery of designs for your dream tropical home.
      </p>
    </header>
  );
};

export default Header;