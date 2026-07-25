import { formsService } from './src/modules/forms/forms.service';
formsService.connectForm({formUrl: 'https://docs.google.com/forms/d/1Z9EBHqs5kNGXWDggXrNlFblahxaJIcAHex6qywvLXc8/edit'}).then(console.log).catch(console.error);
