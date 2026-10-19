import { App, Modal, Setting } from 'obsidian';

/** Asks a yes/no question; resolves to false when dismissed. */
export class ConfirmModal extends Modal {
	private answer = false;
	private resolve: (answer: boolean) => void = () => {};

	constructor(
		app: App,
		private readonly message: string,
		private readonly confirmText: string,
	) {
		super(app);
	}

	ask(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setCta()
					.onClick(() => {
						this.answer = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.answer);
	}
}
