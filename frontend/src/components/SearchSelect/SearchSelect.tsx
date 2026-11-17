import { Check, ChevronDown } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { normalizeText } from './normalizeText';
import styles from './SearchSelect.module.css';

export interface SelectOption {
  id: number;
  name: string;
  /** Second line under the name, for example the variety of a product. */
  detail?: string;
  /** Extra words the search also matches. */
  keywords?: string;
}

export interface SelectGroup {
  key: string;
  /** Heading of the group; a group without it shows no heading. */
  label?: string;
  options: SelectOption[];
}

interface SearchSelectProps {
  label: string;
  groups: SelectGroup[];
  value: number | null;
  onChange: (id: number) => void;
  /** Shown in the empty field. */
  placeholder: string;
  disabled?: boolean;
  /** Message when the search matches nothing. */
  noResults: (query: string) => string;
  /** Shown under the field, for example a loading error. */
  children?: ReactNode;
}

/** Searchable select: a text field that filters a list of options, optionally grouped. */
export function SearchSelect({
  label,
  groups,
  value,
  onChange,
  placeholder,
  disabled = false,
  noResults,
  children,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (optionKey: number) => `${id}-option-${optionKey}`;

  const allOptions = groups.flatMap((group) => group.options);
  const selected = allOptions.find((option) => option.id === value) ?? null;
  const needle = normalizeText(query);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          !needle || normalizeText(`${option.name} ${option.keywords ?? ''}`).includes(needle),
      ),
    }))
    .filter((group) => group.options.length > 0);
  const options = visibleGroups.flatMap((group) => group.options);
  const activeOption = open ? options[activeIndex] : undefined;

  function openList() {
    setQuery('');
    // Start on the selected option so the arrow keys continue from it.
    setActiveIndex(
      Math.max(
        0,
        allOptions.findIndex((option) => option.id === value),
      ),
    );
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery('');
  }

  function select(optionKey: number) {
    onChange(optionKey);
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
      } else if (options.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((activeIndex + step + options.length) % options.length);
      }
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      select(activeOption.id);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeList();
    }
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={selected?.name ?? placeholder}
          value={open ? query : (selected?.name ?? '')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onClick={() => !open && openList()}
          onKeyDown={handleKeyDown}
          onBlur={closeList}
        />
        <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
      </div>

      {children}

      {/* preventDefault on mousedown keeps the focus in the input while an option is clicked. */}
      <div
        id={listId}
        role="listbox"
        aria-label={label}
        className={styles.list}
        hidden={!open}
        onMouseDown={(event) => event.preventDefault()}
      >
        {visibleGroups.map((group) => {
          const groupLabelId = `${id}-group-${group.key}`;
          return (
            <div
              key={group.key}
              role="group"
              aria-labelledby={group.label ? groupLabelId : undefined}
            >
              {group.label && (
                <div id={groupLabelId} className={styles.groupLabel}>
                  {group.label}
                </div>
              )}
              {group.options.map((option) => {
                const isSelected = option.id === value;
                const isActive = option.id === activeOption?.id;
                return (
                  <div
                    key={option.id}
                    id={optionId(option.id)}
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.option} ${isActive ? styles.active : ''}`}
                    ref={
                      isActive ? (node) => node?.scrollIntoView?.({ block: 'nearest' }) : undefined
                    }
                    onClick={() => select(option.id)}
                  >
                    <span className={styles.optionText}>
                      <span className={styles.optionName}>{option.name}</span>
                      {option.detail && <span className={styles.detail}>{option.detail}</span>}
                    </span>
                    {isSelected && <Check className={styles.check} size={16} aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          );
        })}
        {options.length === 0 && <p className={styles.noResults}>{noResults(query)}</p>}
      </div>
    </div>
  );
}
